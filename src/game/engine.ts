import { card, CARDS, TOTAL_WEIGHT } from "./cards";
import type {
  CardDef,
  CardInst,
  Element,
  GameAction,
  GameSettings,
  GameState,
  GameView,
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
export const LOG_LIMIT = 80;
/** A partir desta volta começa o Crepúsculo: todo deus perde Vida no começo da vez, cada vez mais. */
export const TWILIGHT_ROUND = 8;
/** Quanto um bot "pensa" antes de agir, para dar tempo de ver a jogada dele. */
export const BOT_DELAY = { acao: 1500, defesa: 1100, mercado: 1100 } as const;
export const DEFAULT_SETTINGS: GameSettings = { actionSeconds: 40, defenseSeconds: 25 };

export class GameError extends Error {}

export interface NewPlayer {
  id: string;
  name: string;
  bot: boolean;
}

export const STATUS_LABEL: Record<StatusId, string> = { veneno: "Veneno", sono: "Sono", silencio: "Silêncio" };

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
    phase: { type: "acao", player: players[0].id },
    players: {},
    deadline: null,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    nextUid: 1,
    fallenCount: 0,
    log: [],
    logSeq: 0,
  };
  for (const p of players) {
    s.players[p.id] = { id: p.id, name: p.name, bot: p.bot, ...START, hand: [], statuses: [], alive: true };
    give(s, s.players[p.id], HAND_SIZE);
  }
  const first = opts.first ?? s.order[Math.floor(random(s) * s.order.length)];
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
  const kind = s.phase.type as "acao" | "defesa" | "mercado";
  if (s.players[who].bot) {
    s.deadline = now + BOT_DELAY[kind];
    return;
  }
  const secs = kind === "defesa" ? s.settings.defenseSeconds : s.settings.actionSeconds;
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

  const twilight = twilightDamage(s.round);
  if (twilight > 0) {
    p.vida -= twilight;
    log(s, { kind: "crepusculo", target: pid, amount: twilight, text: `O Crepúsculo consome ${twilight} de Vida de ${p.name}.` });
    if (p.vida <= 0) {
      fall(s, p, `${p.name} foi engolido pelo Crepúsculo.`);
      if (!checkOver(s)) endTurn(s, now);
      return;
    }
  }

  if (p.statuses.some((st) => st.id === "veneno")) {
    p.vida -= POISON_DAMAGE;
    log(s, { kind: "dano", target: pid, amount: POISON_DAMAGE, text: `O veneno tira ${POISON_DAMAGE} de Vida de ${p.name}.` });
    if (p.vida <= 0) {
      fall(s, p, `${p.name} sucumbiu ao veneno.`);
      if (!checkOver(s)) endTurn(s, now);
      return;
    }
  }

  give(s, p, Math.max(0, HAND_SIZE - p.hand.length));

  if (p.statuses.some((st) => st.id === "sono")) {
    log(s, { kind: "mazela", target: pid, text: `${p.name} está dormindo e perde a vez.` });
    endTurn(s, now);
    return;
  }

  s.phase = { type: "acao", player: pid };
  setDeadline(s, now);
}

function endTurn(s: GameState, now: number) {
  const p = s.players[s.active];
  if (p.alive) {
    p.statuses = p.statuses.map((st) => ({ ...st, turns: st.turns - 1 })).filter((st) => st.turns > 0);
  }
  if (checkOver(s)) return;
  const next = othersFrom(s, s.active)[0];
  if (s.order.indexOf(next) <= s.order.indexOf(s.active)) s.round++;
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
  const dmg = damageFor(attack, defense);
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
  let power = weapon.attack ?? 0;
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
    text: weapon.area ? `${p.name} ataca todos com ${label} (${power}).` : `${p.name} ataca ${s.players[targets[0]].name} com ${label} (${power}).`,
  });
  startAttack(s, { from: p.id, cards, label, power, element, inflict: weapon.inflict }, targets, now);
}

function targetOther(s: GameState, p: PlayerState, target: string | undefined): PlayerState {
  const t = target ? s.players[target] : undefined;
  if (!t || !t.alive || t.id === p.id) throw new GameError("Escolha um deus vivo como alvo.");
  return t;
}

function useCard(s: GameState, p: PlayerState, a: Extract<GameAction, { type: "usar" }>, now: number) {
  const inst = findInHand(p, a.card);
  const def = card(inst.id);
  const effect = def.effect;
  if (!effect || def.kind === "arma" || def.kind === "reforco" || def.kind === "defesa") {
    throw new GameError(def.kind === "arma" ? "Use a arma para atacar." : `${def.name} não se usa na sua vez.`);
  }
  if (effect.type === "vender" || effect.type === "alquimia") throw new GameError(`${def.name} precisa de mais detalhes.`);

  // Escolhe o alvo antes de gastar qualquer coisa: se ele for inválido, nada muda.
  const target = def.target === "other" ? targetOther(s, p, a.target) : undefined;
  if (effect.type === "furto" && target && target.hand.length === 0) throw new GameError(`${target.name} está sem cartas.`);
  if (effect.type === "furto" && p.hand.length >= HAND_MAX) throw new GameError("Sua mão está cheia.");

  if (def.kind === "milagre") {
    if (p.statuses.some((st) => st.id === "silencio")) throw new GameError("O Silêncio Sagrado impede seus milagres.");
    if (p.fe < (def.cost ?? 0)) throw new GameError(`Fé insuficiente: ${def.name} pede ${def.cost}.`);
    p.fe -= def.cost ?? 0;
  } else {
    takeFromHand(p, inst.uid);
  }

  const kind = def.kind === "milagre" ? "milagre" : def.kind === "item" ? "item" : "troca";
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
      log(s, { kind: "mazela", actor: p.id, target: target!.id, cards: [def.id], text: `${p.name} lança ${def.name} em ${target!.name}.` });
      break;
    case "furto": {
      const i = Math.floor(random(s) * target!.hand.length);
      const [stolen] = target!.hand.splice(i, 1);
      p.hand.push(stolen);
      log(s, { kind, actor: p.id, target: target!.id, cards: [def.id], text: `${p.name} usa ${def.name} e leva uma carta de ${target!.name}.` });
      break;
    }
    case "ataque": {
      const targets = effect.area ? othersFrom(s, p.id) : [target!.id];
      log(s, {
        kind: "ataque",
        actor: p.id,
        target: effect.area ? undefined : target!.id,
        amount: effect.amount,
        element: effect.element,
        cards: [def.id],
        text: effect.area ? `${p.name} invoca ${def.name} sobre todos (${effect.amount}).` : `${p.name} invoca ${def.name} sobre ${target!.name} (${effect.amount}).`,
      });
      startAttack(s, { from: p.id, cards: [inst], label: def.name, power: effect.amount, element: effect.element }, targets, now);
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
    else if (s.active === pid && s.phase.type !== "defesa") endTurn(s, now);
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
          useCard(s, p, action, now);
          break;
        case "vender":
          sell(s, p, action, now);
          break;
        case "alquimia":
          alchemy(s, p, action, now);
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
