import { card, CARDS, GUARDIAN_MAP, GUARDIANS, TOTAL_WEIGHT } from "./cards";
import type {
  CardDef,
  CardInst,
  Element,
  GameAction,
  GameSettings,
  GameState,
  GameView,
  GuardianId,
  LogEntry,
  PendingAttack,
  PlayerState,
  StatusId,
} from "./types";

// O motor do Panteão: funções puras. Recebem um estado e devolvem outro, sem tocar em rede nem relógio
// (o "agora" chega como parâmetro). O servidor é o único que roda isto; os navegadores só recebem a visão.

export const HAND_SIZE = 8;
export const HAND_MAX = 12;
export const MAX_STAT = 99;
export const START = { vida: 36, fe: 10, ouro: 20 } as const;
export const POISON_DAMAGE = 2;
export const SHOP_OFFER = 3;
/** Quantos reforços cabem num golpe. */
export const MAX_BOOSTERS = 2;
export const LOG_LIMIT = 80;
/** A partir desta volta começa o Crepúsculo: todo deus perde Vida no começo da vez, cada vez mais. */
export const TWILIGHT_ROUND = 8;
/** Quanto um bot "pensa" antes de agir, para dar tempo de ver a jogada dele. */
export const BOT_DELAY = { acao: 1900, defesa: 1500, mercado: 1400, proposta: 1600 } as const;
/** Céu e inferno: a Graça cura mas pode levar ao céu; a Danação fere e pode arrastar ao Tártaro. */
export const GRACE_HEAL = 4;
export const GRACE_ASCEND = 0.2;
export const DAMNATION_DAMAGE = 3;
export const DAMNATION_DRAG = 0.15;
export const BLOOD_MOON_BONUS = 3;
export const DEFAULT_SETTINGS: GameSettings = { actionSeconds: 40, defenseSeconds: 25 };

export class GameError extends Error {}

export interface NewPlayer {
  id: string;
  name: string;
  bot: boolean;
}

export const STATUS_LABEL: Record<StatusId, string> = { veneno: "Veneno", sono: "Sono", silencio: "Silêncio", graca: "Graça Celeste", danacao: "Danação" };

// Gerador mulberry32: o estado dele mora no próprio jogo, então a mesma semente repete a mesma partida.
export function random(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function drawCardId(s: GameState): string {
  let roll = random(s) * TOTAL_WEIGHT;
  for (const c of CARDS) {
    roll -= c.weight;
    if (roll < 0) return c.id;
  }
  return CARDS[CARDS.length - 1].id;
}

function newCard(s: GameState, id: string): CardInst {
  return { uid: `c${s.nextUid++}`, id };
}

function give(s: GameState, p: PlayerState, n: number) {
  for (let i = 0; i < n && p.hand.length < HAND_MAX; i++) p.hand.push(newCard(s, drawCardId(s)));
}

function log(s: GameState, entry: Omit<LogEntry, "seq" | "turn">) {
  s.log.push({ seq: ++s.logSeq, turn: s.turn, ...entry });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export function createGame(
  players: NewPlayer[],
  opts: { seed: number; now: number; settings?: Partial<GameSettings>; first?: string },
): GameState {
  if (players.length < 2) throw new GameError("São precisos pelo menos dois deuses.");
  const s: GameState = {
    rng: opts.seed | 0,
    turn: 0,
    round: 1,
    order: players.map((p) => p.id),
    active: players[0].id,
    starter: players[0].id,
    phase: { type: "acao", player: players[0].id },
    players: {},
    deadline: null,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    nextUid: 1,
    fallenCount: 0,
    extraTurn: null,
    phenomenon: null,
    log: [],
    logSeq: 0,
  };
  for (const p of players) {
    s.players[p.id] = { id: p.id, name: p.name, bot: p.bot, ...START, hand: [], statuses: [], alive: true, guardian: null };
    give(s, s.players[p.id], HAND_SIZE);
  }
  const first = opts.first ?? s.order[Math.floor(random(s) * s.order.length)];
  s.starter = first;
  log(s, { kind: "info", text: "Os deuses descem à arena." });
  beginTurn(s, first, opts.now);
  return s;
}

// ---------- Regras de defesa ----------

/** Uma defesa segura o golpe? Neutro: qualquer uma. Elemental: a do mesmo elemento. Abismo: só Luz. Luz: nenhuma. */
export function blocks(def: CardDef, element: Element): boolean {
  if (def.kind !== "defesa") return false;
  if (element === "luz") return false;
  if (def.reflect || def.evade) return true;
  if (element === "neutro") return true;
  if (element === "abismo") return def.element === "luz";
  return def.element === element;
}

export function damageFor(attack: Pick<PendingAttack, "power" | "element">, defense: number): number {
  const dmg = Math.max(0, attack.power - defense);
  return attack.element === "abismo" && defense === 0 ? dmg * 2 : dmg;
}

// ---------- Fluxo de turnos ----------

function decider(s: GameState): string | null {
  return s.phase.type === "fim" ? null : s.phase.player;
}

function setDeadline(s: GameState, now: number) {
  const who = decider(s);
  if (!who) {
    s.deadline = null;
    return;
  }
  const kind = s.phase.type as "acao" | "defesa" | "mercado" | "proposta";
  if (s.players[who].bot) {
    s.deadline = now + BOT_DELAY[kind];
    return;
  }
  const secs = kind === "defesa" || kind === "proposta" ? s.settings.defenseSeconds : s.settings.actionSeconds;
  s.deadline = secs ? now + secs * 1000 : null;
}

function alivePlayers(s: GameState): string[] {
  return s.order.filter((id) => s.players[id].alive);
}

/** Os outros deuses vivos, na ordem da mesa a partir de quem joga. */
function othersFrom(s: GameState, pid: string): string[] {
  const i = s.order.indexOf(pid);
  const rotated = [...s.order.slice(i + 1), ...s.order.slice(0, i)];
  return rotated.filter((id) => s.players[id].alive);
}

function fall(s: GameState, p: PlayerState, reason?: string) {
  p.alive = false;
  p.vida = 0;
  p.hand = [];
  p.statuses = [];
  p.guardian = null;
  p.fallen = ++s.fallenCount;
  log(s, { kind: "queda", actor: p.id, text: reason ?? `${p.name} perdeu toda a Vida e virou estrela.` });
}

function checkOver(s: GameState): boolean {
  const alive = alivePlayers(s);
  if (alive.length > 1) return false;
  const winner = alive[0] ?? null;
  s.phase = { type: "fim", winner };
  s.deadline = null;
  log(s, {
    kind: "vitoria",
    actor: winner ?? undefined,
    text: winner ? `${s.players[winner].name} é o último deus de pé e reina sobre o Panteão!` : "Ninguém restou. O Panteão ficou vazio.",
  });
  return true;
}

function beginTurn(s: GameState, pid: string, now: number) {
  const p = s.players[pid];
  s.active = pid;
  s.turn++;
  log(s, { kind: "turno", actor: pid, text: `Vez de ${p.name}.` });

  if (s.phenomenon && s.round > s.phenomenon.untilRound) {
    log(s, { kind: "prodigio", text: "A Lua de Sangue se põe. Os golpes voltam ao normal." });
    s.phenomenon = null;
  }

  // Cada ameaça do começo da vez pode derrubar: se derrubar, a vez passa (ou a partida acaba).
  const falls = (reason: string) => {
    fall(s, p, reason);
    if (!checkOver(s)) endTurn(s, now);
  };

  const twilight = twilightDamage(s.round);
  if (twilight > 0) {
    p.vida -= twilight;
    log(s, { kind: "crepusculo", target: pid, amount: twilight, text: `O Crepúsculo consome ${twilight} de Vida de ${p.name}.` });
    if (p.vida <= 0) return falls(`${p.name} foi engolido pelo Crepúsculo.`);
  }

  if (has(p, "veneno")) {
    p.vida -= POISON_DAMAGE;
    log(s, { kind: "dano", target: pid, amount: POISON_DAMAGE, text: `O veneno tira ${POISON_DAMAGE} de Vida de ${p.name}.` });
    if (p.vida <= 0) return falls(`${p.name} sucumbiu ao veneno.`);
  }

  if (has(p, "danacao")) {
    p.vida -= DAMNATION_DAMAGE;
    log(s, { kind: "dano", target: pid, amount: DAMNATION_DAMAGE, element: "abismo", text: `A Danação queima ${DAMNATION_DAMAGE} de Vida de ${p.name}.` });
    if (p.vida <= 0) return falls(`${p.name} queimou até o fim na Danação.`);
    if (random(s) < DAMNATION_DRAG) return falls(`Mãos do Tártaro arrastam ${p.name} para baixo!`);
  }

  if (has(p, "graca")) {
    p.vida = cap(p.vida + GRACE_HEAL);
    log(s, { kind: "cura", actor: pid, amount: GRACE_HEAL, text: `A Graça Celeste cura ${GRACE_HEAL} de Vida de ${p.name}.` });
    if (random(s) < GRACE_ASCEND) return falls(`A Graça foi demais: ${p.name} sobe aos céus e não volta.`);
  }

  if (p.guardian) {
    guardianActs(s, p);
    if (s.phase.type === "fim") return;
  }

  give(s, p, Math.max(0, HAND_SIZE - p.hand.length));

  if (has(p, "sono")) {
    log(s, { kind: "mazela", target: pid, text: `${p.name} está dormindo e perde a vez.` });
    endTurn(s, now);
    return;
  }

  s.phase = { type: "acao", player: pid };
  setDeadline(s, now);
}

function has(p: PlayerState, status: StatusId) {
  return p.statuses.some((st) => st.id === status);
}

// ---------- Guardiões ----------

function summon(s: GameState, p: PlayerState, id?: GuardianId) {
  const def = id ? GUARDIAN_MAP[id] : GUARDIANS[Math.floor(random(s) * GUARDIANS.length)];
  const replaced = p.guardian ? GUARDIAN_MAP[p.guardian.id].name : null;
  p.guardian = { id: def.id, vida: def.vida };
  log(s, { kind: "guardiao", actor: p.id, element: def.element, text: `${p.name} invoca ${def.name}${replaced ? ` no lugar de ${replaced}` : ""}.` });
}

function hurtGuardian(s: GameState, p: PlayerState, amount: number) {
  if (!p.guardian || amount <= 0) return;
  const def = GUARDIAN_MAP[p.guardian.id];
  p.guardian.vida -= amount;
  if (p.guardian.vida <= 0) {
    p.guardian = null;
    log(s, { kind: "guardiao", target: p.id, text: `${def.name} de ${p.name} se desfaz em poeira de estrela.` });
  } else {
    log(s, { kind: "guardiao", target: p.id, amount, text: `${def.name} de ${p.name} sofre ${amount}.` });
  }
}

/** O Golem segura o dano que iria para o dono. Devolve quanto sobrou para o deus. */
function golemAbsorbs(s: GameState, p: PlayerState, dmg: number): number {
  if (dmg <= 0 || p.guardian?.id !== "golem") return dmg;
  const taken = Math.min(dmg, p.guardian.vida);
  log(s, { kind: "guardiao", target: p.id, amount: taken, text: `O Golem de Bronze se põe na frente e segura ${taken}.` });
  hurtGuardian(s, p, taken);
  return dmg - taken;
}

/** Dano direto (sem fase de defesa), como o golpe de um guardião. */
function strike(s: GameState, target: PlayerState, amount: number, element: Element, source: string) {
  const dmg = golemAbsorbs(s, target, amount);
  if (dmg > 0) {
    target.vida -= dmg;
    log(s, { kind: "dano", target: target.id, amount: dmg, element, text: `${source} acerta ${target.name}: ${dmg} de dano.` });
    if (target.vida <= 0) fall(s, target);
  }
  checkOver(s);
}

function guardianActs(s: GameState, p: PlayerState) {
  const g = p.guardian!;
  const def = GUARDIAN_MAP[g.id];
  if (def.act.type === "escudo" || random(s) >= def.chance) return;
  const enemies = othersFrom(s, p.id);
  const enemy = enemies[Math.floor(random(s) * enemies.length)];
  switch (def.act.type) {
    case "golpe":
      log(s, { kind: "guardiao", actor: p.id, target: enemy, element: def.element, text: `${def.name} de ${p.name} ataca ${s.players[enemy].name}!` });
      strike(s, s.players[enemy], def.act.amount, def.act.element, def.name);
      break;
    case "cura":
      p.vida = cap(p.vida + def.act.amount);
      log(s, { kind: "cura", actor: p.id, amount: def.act.amount, text: `${def.name} cura ${def.act.amount} de Vida de ${p.name}.` });
      break;
    case "fe":
      p.fe = cap(p.fe + def.act.amount);
      log(s, { kind: "guardiao", actor: p.id, amount: def.act.amount, text: `${def.name} traz ${def.act.amount} de Fé para ${p.name}.` });
      break;
    case "ouro":
      p.ouro = cap(p.ouro + def.act.amount);
      log(s, { kind: "guardiao", actor: p.id, amount: def.act.amount, text: `${def.name} acha ${def.act.amount} de Ouro para ${p.name}.` });
      break;
    case "veneno":
      addStatus(s, s.players[enemy], "veneno", def.act.turns);
      log(s, { kind: "mazela", actor: p.id, target: enemy, text: `${def.name} de ${p.name} envenena ${s.players[enemy].name}.` });
      break;
  }
}

function endTurn(s: GameState, now: number) {
  const p = s.players[s.active];
  if (p.alive) {
    p.statuses = p.statuses.map((st) => ({ ...st, turns: st.turns - 1 })).filter((st) => st.turns > 0);
  }
  if (checkOver(s)) return;
  if (s.extraTurn === s.active && p.alive) {
    s.extraTurn = null;
    log(s, { kind: "prodigio", actor: p.id, text: `O Cetro do Tempo gira: ${p.name} joga de novo!` });
    beginTurn(s, p.id, now);
    return;
  }
  s.extraTurn = null;
  const next = othersFrom(s, s.active)[0];
  // Posições contadas a partir de quem abriu a partida (funciona mesmo se essa pessoa já caiu).
  const n = s.order.length;
  const seat = (id: string) => (s.order.indexOf(id) - s.order.indexOf(s.starter) + n) % n;
  if (seat(next) <= seat(s.active)) s.round++;
  beginTurn(s, next, now);
}

/** Dano do Crepúsculo na volta: 1 na primeira volta, e sobe 1 a cada volta. */
export function twilightDamage(round: number): number {
  return round < TWILIGHT_ROUND ? 0 : 1 + (round - TWILIGHT_ROUND);
}

function addStatus(s: GameState, p: PlayerState, status: StatusId, turns: number) {
  // Quem recebe a mazela na própria vez (um golpe refletido) não pode perdê-la já no fim desta vez.
  if (p.id === s.active) turns++;
  const current = p.statuses.find((st) => st.id === status);
  if (current) current.turns = Math.max(current.turns, turns);
  else p.statuses.push({ id: status, turns });
}

function takeFromHand(p: PlayerState, uid: string): CardInst {
  const i = p.hand.findIndex((c) => c.uid === uid);
  if (i < 0) throw new GameError("Essa carta não está na sua mão.");
  return p.hand.splice(i, 1)[0];
}

function findInHand(p: PlayerState, uid: string): CardInst {
  const c = p.hand.find((h) => h.uid === uid);
  if (!c) throw new GameError("Essa carta não está na sua mão.");
  return c;
}

function cap(n: number) {
  return Math.min(MAX_STAT, n);
}

// ---------- Golpes ----------

/** A Lua de Sangue soma em todo golpe enquanto estiver no céu. */
function moonBonus(s: GameState): number {
  return s.phenomenon?.id === "lua-de-sangue" ? BLOOD_MOON_BONUS : 0;
}

function startAttack(s: GameState, attack: Omit<PendingAttack, "current" | "queue" | "reflected">, targets: string[], now: number) {
  if (targets.length === 0) {
    endTurn(s, now);
    return;
  }
  const [current, ...queue] = targets;
  s.phase = { type: "defesa", player: current, attack: { ...attack, current, queue, reflected: 0 } };
  setDeadline(s, now);
}

function continueAttack(s: GameState, attack: PendingAttack, now: number) {
  while (attack.queue.length > 0) {
    const next = attack.queue.shift()!;
    if (!s.players[next].alive) continue;
    attack.current = next;
    s.phase = { type: "defesa", player: next, attack };
    setDeadline(s, now);
    return;
  }
  endTurn(s, now);
}

function hit(s: GameState, attack: PendingAttack, target: PlayerState, defense: number, now: number) {
  if (attack.area) hurtGuardian(s, target, attack.power);
  if (attack.lethal && defense === 0) {
    if (target.guardian?.id === "golem") {
      target.guardian = null;
      log(s, { kind: "guardiao", target: target.id, text: `O Golem de Bronze se joga na frente da Sentença e é levado no lugar de ${target.name}.` });
    } else {
      fall(s, target, `A Sentença do Tártaro se cumpre: ${target.name} cai na hora.`);
    }
    if (checkOver(s)) return;
    continueAttack(s, attack, now);
    return;
  }
  const dmg = golemAbsorbs(s, target, damageFor(attack, defense));
  if (dmg > 0) {
    target.vida -= dmg;
    log(s, {
      kind: "dano",
      actor: attack.from,
      target: target.id,
      amount: dmg,
      element: attack.element,
      text: `${target.name} sofre ${dmg} de dano${attack.element === "abismo" && defense === 0 ? " (o Abismo dobra o golpe sem defesa)" : ""}.`,
    });
    if (attack.inflict && target.vida > 0) {
      addStatus(s, target, attack.inflict.status, attack.inflict.turns);
      log(s, { kind: "mazela", target: target.id, text: `${target.name} recebe ${STATUS_LABEL[attack.inflict.status]}.` });
    }
    if (target.vida <= 0) fall(s, target);
  } else {
    log(s, { kind: "defesa", target: target.id, text: `${target.name} segura o golpe inteiro.` });
  }
  if (checkOver(s)) return;
  continueAttack(s, attack, now);
}

function defend(s: GameState, p: PlayerState, uids: string[], now: number) {
  if (s.phase.type !== "defesa") throw new GameError("Não há golpe para defender.");
  const attack = s.phase.attack;
  if (new Set(uids).size !== uids.length) throw new GameError("Carta repetida.");
  const defs = uids.map((uid) => card(findInHand(p, uid).id));
  for (const d of defs) {
    if (d.kind !== "defesa") throw new GameError(`${d.name} não é uma defesa.`);
    if (!blocks(d, attack.element)) throw new GameError(`${d.name} não segura um golpe de ${attack.element === "luz" ? "Luz" : attack.element}.`);
  }
  const special = defs.filter((d) => d.reflect || d.evade);
  if (special.length > 0 && defs.length > 1) throw new GameError(`${special[0].name} precisa ser usada sozinha.`);
  const used = uids.map((uid) => takeFromHand(p, uid));

  if (special[0]?.reflect) {
    const back = attack.from;
    log(s, { kind: "defesa", actor: p.id, target: back, cards: [used[0].id], text: `${p.name} ergue o Espelho Celeste e devolve o golpe para ${s.players[back].name}!` });
    attack.reflected++;
    attack.from = p.id;
    attack.current = back;
    if (!s.players[back].alive) {
      continueAttack(s, attack, now);
      return;
    }
    s.phase = { type: "defesa", player: back, attack };
    setDeadline(s, now);
    return;
  }

  if (special[0]?.evade) {
    if (random(s) < special[0].evade) {
      log(s, { kind: "defesa", actor: p.id, cards: [used[0].id], text: `${p.name} some no ar e o golpe passa direto.` });
      continueAttack(s, attack, now);
      return;
    }
    log(s, { kind: "defesa", actor: p.id, cards: [used[0].id], text: `${p.name} tenta o Passo Etéreo, mas não escapa.` });
    hit(s, attack, p, 0, now);
    return;
  }

  const total = defs.reduce((sum, d) => sum + (d.defense ?? 0), 0);
  if (used.length > 0) {
    log(s, { kind: "defesa", actor: p.id, amount: total, cards: used.map((c) => c.id), text: `${p.name} defende com ${defs.map((d) => d.name).join(" + ")} (${total}).` });
  }
  hit(s, attack, p, total, now);
}

// ---------- Ações da vez ----------

function attackWith(s: GameState, p: PlayerState, a: Extract<GameAction, { type: "atacar" }>, now: number) {
  const weaponInst = findInHand(p, a.weapon);
  const weapon = card(weaponInst.id);
  if (weapon.kind !== "arma") throw new GameError(`${weapon.name} não é uma arma.`);
  const boosterIds = a.boosters ?? [];
  if (boosterIds.length > MAX_BOOSTERS) throw new GameError(`No máximo ${MAX_BOOSTERS} reforços por golpe.`);
  if (new Set([a.weapon, ...boosterIds]).size !== boosterIds.length + 1) throw new GameError("Carta repetida.");
  const boosters = boosterIds.map((uid) => card(findInHand(p, uid).id));
  for (const b of boosters) if (b.kind !== "reforco") throw new GameError(`${b.name} não é um reforço.`);

  let targets: string[];
  if (weapon.area) targets = othersFrom(s, p.id);
  else {
    const t = s.players[a.target];
    if (!t || !t.alive || t.id === p.id) throw new GameError("Escolha um deus vivo como alvo.");
    targets = [t.id];
  }

  const cards = [a.weapon, ...boosterIds].map((uid) => takeFromHand(p, uid));
  let element = weapon.element;
  let power = (weapon.attack ?? 0) + moonBonus(s);
  for (const b of boosters) {
    power += b.boost ?? 0;
    if (b.convert) element = b.convert;
  }
  const label = [weapon.name, ...boosters.map((b) => b.name)].join(" + ");
  log(s, {
    kind: "ataque",
    actor: p.id,
    target: weapon.area ? undefined : targets[0],
    amount: power,
    element,
    cards: cards.map((c) => c.id),
    text: `${p.name} ataca ${weapon.area ? "todos" : s.players[targets[0]].name} com ${label} (${power}${moonBonus(s) ? ", com a Lua de Sangue" : ""}).`,
  });
  startAttack(s, { from: p.id, cards, label, power, element, inflict: weapon.inflict, lethal: weapon.lethal, area: weapon.area }, targets, now);
}

function targetOther(s: GameState, p: PlayerState, target: string | undefined): PlayerState {
  const t = target ? s.players[target] : undefined;
  if (!t || !t.alive || t.id === p.id) throw new GameError("Escolha um deus vivo como alvo.");
  return t;
}

function targetAny(s: GameState, p: PlayerState, target: string | undefined): PlayerState {
  const t = target ? s.players[target] : p;
  if (!t || !t.alive) throw new GameError("Escolha um deus vivo como alvo.");
  return t;
}

function playCard(s: GameState, p: PlayerState, a: Extract<GameAction, { type: "usar" }>, now: number) {
  const inst = findInHand(p, a.card);
  const def = card(inst.id);
  const effect = def.effect;
  if (!effect || def.kind === "arma" || def.kind === "reforco" || def.kind === "defesa") {
    throw new GameError(def.kind === "arma" ? "Use a arma para atacar." : `${def.name} não se usa na sua vez.`);
  }
  if (effect.type === "vender" || effect.type === "alquimia" || effect.type === "escambo") throw new GameError(`${def.name} precisa de mais detalhes.`);

  // Escolhe o alvo antes de gastar qualquer coisa: se ele for inválido, nada muda.
  const target = def.target === "other" ? targetOther(s, p, a.target) : def.target === "any" ? targetAny(s, p, a.target) : undefined;
  if (effect.type === "banir" && target && !target.guardian) throw new GameError(`${target.name} não tem guardião.`);
  if (effect.type === "furto" && target && target.hand.length === 0) throw new GameError(`${target.name} está sem cartas.`);
  if (effect.type === "furto" && p.hand.length >= HAND_MAX) throw new GameError("Sua mão está cheia.");

  if (def.kind === "milagre") {
    if (p.statuses.some((st) => st.id === "silencio")) throw new GameError("O Silêncio Sagrado impede seus milagres.");
    if (p.fe < (def.cost ?? 0)) throw new GameError(`Fé insuficiente: ${def.name} pede ${def.cost}.`);
    p.fe -= def.cost ?? 0;
  } else {
    takeFromHand(p, inst.uid);
  }

  const kind = def.kind === "milagre" ? "milagre" : def.kind === "item" ? "item" : def.kind === "prodigio" ? "prodigio" : "troca";
  switch (effect.type) {
    case "cura":
      p.vida = cap(p.vida + effect.amount);
      log(s, { kind: "cura", actor: p.id, amount: effect.amount, cards: [def.id], text: `${p.name} usa ${def.name} e recupera ${effect.amount} de Vida.` });
      break;
    case "fe":
      p.fe = cap(p.fe + effect.amount);
      log(s, { kind, actor: p.id, amount: effect.amount, cards: [def.id], text: `${p.name} usa ${def.name} e recupera ${effect.amount} de Fé.` });
      break;
    case "ouro":
      p.ouro = cap(p.ouro + effect.amount);
      log(s, { kind, actor: p.id, amount: effect.amount, cards: [def.id], text: `${p.name} abre a ${def.name}: +${effect.amount} de Ouro.` });
      break;
    case "purificar":
      p.statuses = [];
      if (effect.heal) p.vida = cap(p.vida + effect.heal);
      log(s, { kind: effect.heal ? "cura" : kind, actor: p.id, amount: effect.heal, cards: [def.id], text: `${p.name} usa ${def.name} e fica livre das mazelas${effect.heal ? ` (+${effect.heal} de Vida)` : ""}.` });
      break;
    case "profecia":
      give(s, p, effect.amount);
      log(s, { kind, actor: p.id, cards: [def.id], text: `${p.name} usa ${def.name} e compra ${effect.amount} cartas.` });
      break;
    case "mazela":
      addStatus(s, target!, effect.status, effect.turns);
      if (target!.id === p.id) {
        log(s, { kind: "mazela", actor: p.id, target: p.id, cards: [def.id], text: `${p.name} usa ${def.name} em si mesmo.` });
        break;
      }
      log(s, { kind: "mazela", actor: p.id, target: target!.id, cards: [def.id], text: `${p.name} lança ${def.name} em ${target!.name}.` });
      break;
    case "furto": {
      const n = Math.min(effect.amount ?? 1, target!.hand.length, HAND_MAX - p.hand.length);
      for (let k = 0; k < n; k++) {
        const i = Math.floor(random(s) * target!.hand.length);
        p.hand.push(...target!.hand.splice(i, 1));
      }
      log(s, { kind, actor: p.id, target: target!.id, cards: [def.id], text: `${p.name} usa ${def.name} e leva ${n === 1 ? "uma carta" : `${n} cartas`} de ${target!.name}.` });
      break;
    }
    case "renascer":
      p.vida = Math.max(p.vida, START.vida);
      p.statuses = [];
      log(s, { kind: "cura", actor: p.id, cards: [def.id], text: `${p.name} usa ${def.name} e volta inteiro: ${p.vida} de Vida.` });
      break;
    case "turno-extra":
      s.extraTurn = p.id;
      log(s, { kind, actor: p.id, cards: [def.id], text: `${p.name} ergue o ${def.name}: vai jogar de novo.` });
      break;
    case "pacto":
      p.fe = cap(p.fe + effect.fe);
      addStatus(s, p, effect.status, effect.turns);
      log(s, { kind: "mazela", actor: p.id, target: p.id, cards: [def.id], text: `${p.name} assina o ${def.name}: +${effect.fe} de Fé e ${STATUS_LABEL[effect.status]}.` });
      break;
    case "invocar":
      summon(s, p, effect.guardian);
      break;
    case "banir": {
      const name = GUARDIAN_MAP[target!.guardian!.id].name;
      target!.guardian = null;
      log(s, { kind: "guardiao", actor: p.id, target: target!.id, cards: [def.id], text: `${p.name} usa ${def.name}: ${name} de ${target!.name} some.` });
      break;
    }
    case "hora-zero":
      for (const id of alivePlayers(s)) s.players[id].vida = 1;
      log(s, { kind: "prodigio", actor: p.id, cards: [def.id], text: `${p.name} invoca a ${def.name}! A Vida de todos os deuses vira 1.` });
      break;
    case "conjuncao":
      log(s, { kind: "prodigio", actor: p.id, cards: [def.id], text: `${p.name} provoca a ${def.name}: os astros se alinham!` });
      for (const id of [p.id, ...othersFrom(s, p.id)]) summon(s, s.players[id]);
      break;
    case "destinos": {
      const mine = p.vida;
      p.vida = target!.vida;
      target!.vida = mine;
      log(s, { kind: "prodigio", actor: p.id, target: target!.id, cards: [def.id], text: `${p.name} usa ${def.name} com ${target!.name}: agora ${p.vida} e ${target!.vida} de Vida.` });
      break;
    }
    case "diluvio":
      for (const id of alivePlayers(s)) {
        s.players[id].hand = [];
        give(s, s.players[id], HAND_SIZE);
      }
      log(s, { kind: "prodigio", actor: p.id, cards: [def.id], text: `${p.name} solta o ${def.name}: todas as mãos são levadas e renovadas.` });
      break;
    case "fenomeno":
      s.phenomenon = { id: effect.phenomenon, untilRound: s.round + effect.rounds };
      log(s, { kind: "prodigio", actor: p.id, cards: [def.id], text: `${p.name} chama a ${def.name}: todo golpe ganha +${BLOOD_MOON_BONUS} até a volta ${s.round + effect.rounds}.` });
      break;
    case "ataque": {
      const targets = effect.area ? othersFrom(s, p.id) : [target!.id];
      log(s, {
        kind: "ataque",
        actor: p.id,
        target: effect.area ? undefined : target!.id,
        amount: effect.amount + moonBonus(s),
        element: effect.element,
        cards: [def.id],
        text: `${p.name} invoca ${def.name} sobre ${effect.area ? "todos" : target!.name} (${effect.amount + moonBonus(s)}).`,
      });
      startAttack(s, { from: p.id, cards: [inst], label: def.name, power: effect.amount + moonBonus(s), element: effect.element, area: effect.area }, targets, now);
      return;
    }
    case "comprar": {
      const offer = Array.from({ length: SHOP_OFFER }, () => newCard(s, drawCardId(s)));
      log(s, { kind: "troca", actor: p.id, cards: [def.id], text: `${p.name} abre o ${def.name}.` });
      s.phase = { type: "mercado", player: p.id, offer };
      setDeadline(s, now);
      return;
    }
  }
  endTurn(s, now);
}

function sell(s: GameState, p: PlayerState, a: Extract<GameAction, { type: "vender" }>, now: number) {
  const broker = card(findInHand(p, a.card).id);
  if (broker.effect?.type !== "vender") throw new GameError(`${broker.name} não compra cartas.`);
  if (a.item === a.card) throw new GameError("Escolha outra carta para vender.");
  const item = card(findInHand(p, a.item).id);
  takeFromHand(p, a.card);
  takeFromHand(p, a.item);
  p.ouro = cap(p.ouro + item.price);
  log(s, { kind: "troca", actor: p.id, amount: item.price, cards: [broker.id, item.id], text: `${p.name} vende ${item.name} por ${item.price} de Ouro.` });
  endTurn(s, now);
}

function alchemy(s: GameState, p: PlayerState, a: Extract<GameAction, { type: "alquimia" }>, now: number) {
  const scale = card(findInHand(p, a.card).id);
  if (scale.effect?.type !== "alquimia") throw new GameError(`${scale.name} não faz alquimia.`);
  const values = [a.vida, a.fe, a.ouro];
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > MAX_STAT)) throw new GameError("Valores inválidos.");
  if (a.vida < 1) throw new GameError("A Vida precisa ficar em pelo menos 1.");
  if (a.vida + a.fe + a.ouro !== p.vida + p.fe + p.ouro) throw new GameError("A soma precisa continuar a mesma.");
  takeFromHand(p, a.card);
  p.vida = a.vida;
  p.fe = a.fe;
  p.ouro = a.ouro;
  log(s, { kind: "troca", actor: p.id, cards: [scale.id], text: `${p.name} pesa tudo na ${scale.name}: Vida ${a.vida}, Fé ${a.fe}, Ouro ${a.ouro}.` });
  endTurn(s, now);
}

function offerTrade(s: GameState, p: PlayerState, a: Extract<GameAction, { type: "escambo" }>, now: number) {
  const scroll = card(findInHand(p, a.card).id);
  if (scroll.effect?.type !== "escambo") throw new GameError(`${scroll.name} não faz escambo.`);
  if (a.item === a.card) throw new GameError("Escolha outra carta para oferecer.");
  findInHand(p, a.item);
  const t = targetOther(s, p, a.target);
  if (!Number.isInteger(a.price) || a.price < 0 || a.price > MAX_STAT) throw new GameError("Preço inválido.");
  takeFromHand(p, a.card);
  const item = takeFromHand(p, a.item);
  log(s, { kind: "troca", actor: p.id, target: t.id, amount: a.price, cards: [scroll.id, item.id], text: `${p.name} oferece ${card(item.id).name} a ${t.name} por ${a.price} de Ouro.` });
  s.phase = { type: "proposta", player: t.id, trade: { from: p.id, item, price: a.price } };
  setDeadline(s, now);
}

function answerTrade(s: GameState, p: PlayerState, accept: boolean, now: number) {
  if (s.phase.type !== "proposta") throw new GameError("Não há proposta.");
  const { from, item, price } = s.phase.trade;
  const seller = s.players[from];
  if (accept) {
    if (p.ouro < price) throw new GameError(`Ouro insuficiente: a proposta pede ${price}.`);
    if (p.hand.length >= HAND_MAX) throw new GameError("Sua mão está cheia.");
    p.ouro -= price;
    seller.ouro = cap(seller.ouro + price);
    p.hand.push(item);
    log(s, { kind: "troca", actor: p.id, target: from, amount: price, cards: [item.id], text: `${p.name} aceita: leva ${card(item.id).name} por ${price} de Ouro.` });
  } else {
    if (seller.alive) seller.hand.push(item);
    log(s, { kind: "troca", actor: p.id, target: from, text: `${p.name} recusa a proposta de ${seller.name}.` });
  }
  endTurn(s, now);
}

function buy(s: GameState, p: PlayerState, offerUid: string | null, now: number) {
  if (s.phase.type !== "mercado") throw new GameError("O mercado está fechado.");
  if (offerUid) {
    const pick = s.phase.offer.find((c) => c.uid === offerUid);
    if (!pick) throw new GameError("Essa relíquia não está à venda.");
    const def = card(pick.id);
    if (p.ouro < def.price) throw new GameError(`Ouro insuficiente: ${def.name} custa ${def.price}.`);
    if (p.hand.length >= HAND_MAX) throw new GameError("Sua mão está cheia.");
    p.ouro -= def.price;
    p.hand.push(pick);
    log(s, { kind: "troca", actor: p.id, amount: def.price, text: `${p.name} compra uma relíquia por ${def.price} de Ouro.` });
  } else {
    log(s, { kind: "troca", actor: p.id, text: `${p.name} sai do mercado sem comprar.` });
  }
  endTurn(s, now);
}

/** Aplica a decisão de um jogador. Lança GameError se a jogada não vale. */
export function applyAction(state: GameState, pid: string, action: GameAction, now: number): GameState {
  if (state.phase.type === "fim") throw new GameError("A partida acabou.");
  const s = structuredClone(state);
  const p = s.players[pid];
  if (!p) throw new GameError("Você não está nesta partida.");
  if (!p.alive) throw new GameError("Você já virou estrela.");

  if (action.type === "desistir") {
    const wasDeciding = decider(s) === pid;
    fall(s, p, `${p.name} desistiu e deixou a arena.`);
    if (checkOver(s)) return s;
    if (s.phase.type === "defesa" && wasDeciding) continueAttack(s, s.phase.attack, now);
    else if (s.phase.type === "proposta" && wasDeciding) {
      const { from, item } = s.phase.trade;
      if (s.players[from].alive) s.players[from].hand.push(item);
      endTurn(s, now);
    } else if (s.active === pid && s.phase.type !== "defesa" && s.phase.type !== "proposta") endTurn(s, now);
    return s;
  }

  if (decider(s) !== pid) throw new GameError("Não é a sua vez.");

  switch (s.phase.type) {
    case "acao":
      switch (action.type) {
        case "orar":
          give(s, p, 1);
          log(s, { kind: "oracao", actor: p.id, text: `${p.name} ora aos céus e recebe uma carta.` });
          endTurn(s, now);
          break;
        case "atacar":
          attackWith(s, p, action, now);
          break;
        case "usar":
          playCard(s, p, action, now);
          break;
        case "vender":
          sell(s, p, action, now);
          break;
        case "alquimia":
          alchemy(s, p, action, now);
          break;
        case "escambo":
          offerTrade(s, p, action, now);
          break;
        default:
          throw new GameError("Essa jogada não vale agora.");
      }
      break;
    case "defesa":
      if (action.type !== "defender") throw new GameError("Você está sendo atacado: defenda ou receba o golpe.");
      defend(s, p, action.cards, now);
      break;
    case "mercado":
      if (action.type !== "comprar") throw new GameError("Escolha uma relíquia ou saia do mercado.");
      buy(s, p, action.offer, now);
      break;
    case "proposta":
      if (action.type !== "responder") throw new GameError("Aceite ou recuse a proposta.");
      answerTrade(s, p, action.accept, now);
      break;
  }
  return s;
}

/** A jogada padrão quando o tempo acaba: orar, receber o golpe ou sair do mercado. */
export function timeoutAction(s: GameState): GameAction | null {
  switch (s.phase.type) {
    case "acao":
      return { type: "orar" };
    case "defesa":
      return { type: "defender", cards: [] };
    case "mercado":
      return { type: "comprar", offer: null };
    case "proposta":
      return { type: "responder", accept: false };
    default:
      return null;
  }
}

/** Quem precisa decidir agora (ou null se a partida acabou). */
export function currentDecider(s: GameState): string | null {
  return decider(s);
}

/** A visão de um jogador: esconde as mãos alheias e a oferta do mercado de outra pessoa. */
export function viewFor(s: GameState, pid: string | null): GameView {
  const players: GameView["players"] = {};
  for (const id of s.order) {
    const { hand, ...rest } = s.players[id];
    players[id] = { ...rest, statuses: rest.statuses.map((st) => ({ ...st })), handCount: hand.length };
  }
  const phase: GameView["phase"] = s.phase.type === "mercado" ? { ...s.phase, offer: s.phase.player === pid ? s.phase.offer : null } : s.phase;
  const me = pid && s.players[pid] ? { id: pid, hand: s.players[pid].hand } : null;
  return {
    turn: s.turn,
    round: s.round,
    phenomenon: s.phenomenon,
    order: s.order,
    active: s.active,
    phase,
    players,
    deadline: s.deadline,
    settings: s.settings,
    log: s.log,
    me,
  };
}
