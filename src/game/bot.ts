import { card } from "./cards";
import { blocks, damageFor, HAND_MAX } from "./engine";
import type { CardDef, CardInst, GameAction, GameState, PendingAttack, PlayerState } from "./types";

// Os bots jogam só com o que um jogador de verdade veria: a própria mão e o que está na mesa.
// A sorte deles vem de um hash do estado, sem mexer no gerador da partida.

function noise(s: GameState, salt: number): number {
  let h = (s.rng ^ Math.imul(s.turn + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Hand = { inst: CardInst; def: CardDef }[];

function handOf(p: PlayerState): Hand {
  return p.hand.map((inst) => ({ inst, def: card(inst.id) }));
}

function opponents(s: GameState, me: string): PlayerState[] {
  return s.order.map((id) => s.players[id]).filter((p) => p.alive && p.id !== me);
}

/** O alvo preferido: quem está com menos Vida (desempate pelo que tem menos cartas para se defender). */
function pickTarget(s: GameState, me: string): PlayerState {
  const opp = opponents(s, me);
  return opp.reduce((best, p) => {
    const score = p.vida + p.hand.length * 0.5;
    const bestScore = best.vida + best.hand.length * 0.5;
    return score < bestScore ? p : best;
  }, opp[0]);
}

function heal(s: GameState, p: PlayerState, hand: Hand): GameAction | null {
  const silenced = p.statuses.some((st) => st.id === "silencio");
  const options = hand.filter(({ def }) => {
    if (def.effect?.type !== "cura" && !(def.effect?.type === "purificar" && def.effect.heal)) return false;
    if (def.kind === "milagre") return !silenced && p.fe >= (def.cost ?? 0);
    return true;
  });
  if (options.length === 0) return null;
  // Prefere o item (some da mão) ao milagre (gasta Fé).
  const pick = options.find((o) => o.def.kind === "item") ?? options[0];
  return { type: "usar", card: pick.inst.uid };
}

function attackPlan(s: GameState, p: PlayerState, hand: Hand): GameAction | null {
  const weapons = hand.filter((h) => h.def.kind === "arma");
  const silenced = p.statuses.some((st) => st.id === "silencio");
  const spells = hand.filter((h) => h.def.effect?.type === "ataque" && !silenced && p.fe >= (h.def.cost ?? 0) + 2);
  if (weapons.length === 0 && spells.length === 0) return null;

  const target = pickTarget(s, p.id);
  // Golpes que a mesa não consegue segurar com facilidade valem mais.
  const value = (def: CardDef, power: number) => {
    const elementBonus = def.element === "luz" ? 3 : def.element === "abismo" ? 4 : def.element === "neutro" ? 0 : 1.5;
    const areaBonus = def.area || (def.effect?.type === "ataque" && def.effect.area) ? opponents(s, p.id).length - 1 : 0;
    return power + elementBonus + areaBonus * 2 + (def.inflict ? 2 : 0);
  };

  let best: { action: GameAction; score: number } | null = null;
  for (const w of weapons) {
    const score = value(w.def, w.def.attack ?? 0);
    if (!best || score > best.score) best = { action: { type: "atacar", weapon: w.inst.uid, boosters: [], target: target.id }, score };
  }
  for (const sp of spells) {
    const fx = sp.def.effect as Extract<CardDef["effect"], { type: "ataque" }>;
    const score = value(sp.def, fx.amount) - 1;
    if (!best || score > best.score) best = { action: { type: "usar", card: sp.inst.uid, target: fx.area ? undefined : target.id }, score };
  }
  if (!best) return null;

  // Reforços: usa quando o alvo está ao alcance ou quando sobra mão.
  if (best.action.type === "atacar") {
    const boosters = hand.filter((h) => h.def.kind === "reforco");
    const weapon = card(hand.find((h) => h.inst.uid === (best.action as { weapon: string }).weapon)!.inst.id);
    const base = weapon.attack ?? 0;
    const add = boosters.reduce((sum, b) => sum + (b.def.boost ?? 0), 0);
    const finisher = target.vida <= base + add + 2;
    if (boosters.length > 0 && (finisher || p.hand.length >= HAND_MAX - 2 || noise(s, 3) < 0.45)) {
      // Não converte uma arma de Luz ou Abismo: perderia a vantagem.
      const keep = weapon.element === "luz" || weapon.element === "abismo" ? boosters.filter((b) => !b.def.convert) : boosters;
      best.action.boosters = keep.map((b) => b.inst.uid);
    }
  }
  return best.action;
}

function utility(s: GameState, p: PlayerState, hand: Hand): GameAction | null {
  const silenced = p.statuses.some((st) => st.id === "silencio");
  const sick = p.statuses.some((st) => st.id === "veneno");
  for (const { inst, def } of hand) {
    const fx = def.effect;
    if (!fx) continue;
    const canCast = def.kind !== "milagre" || (!silenced && p.fe >= (def.cost ?? 0));
    if (!canCast) continue;
    if (fx.type === "purificar" && sick) return { type: "usar", card: inst.uid };
    if (fx.type === "fe" && p.fe < 5) return { type: "usar", card: inst.uid };
    if (fx.type === "ouro" && p.ouro < 15) return { type: "usar", card: inst.uid };
    if (fx.type === "comprar" && p.ouro >= 10) return { type: "usar", card: inst.uid };
    if (fx.type === "profecia" && p.hand.length <= HAND_MAX - 3 && p.fe >= 6) return { type: "usar", card: inst.uid };
    if (fx.type === "mazela" && p.fe >= 7 && noise(s, 11) < 0.5) {
      const t = pickTarget(s, p.id);
      if (!t.statuses.some((st) => st.id === fx.status)) return { type: "usar", card: inst.uid, target: t.id };
    }
    if (fx.type === "furto" && p.fe >= 7 && p.hand.length < HAND_MAX) {
      const t = opponents(s, p.id).sort((a, b) => b.hand.length - a.hand.length)[0];
      if (t && t.hand.length > 0) return { type: "usar", card: inst.uid, target: t.id };
    }
    if (fx.type === "alquimia" && p.vida < 14 && p.fe + p.ouro >= 8) {
      const pool = p.vida + p.fe + p.ouro;
      const fe = Math.min(p.fe, 6);
      return { type: "alquimia", card: inst.uid, vida: pool - fe, fe, ouro: 0 };
    }
    if (fx.type === "vender") {
      // Vende a carta mais cara que não seja arma nem defesa.
      const extra = hand.filter((h) => h.inst.uid !== inst.uid && h.def.kind !== "arma" && h.def.kind !== "defesa").sort((a, b) => b.def.price - a.def.price)[0];
      if (extra && extra.def.price >= 4) return { type: "vender", card: inst.uid, item: extra.inst.uid };
    }
  }
  return null;
}

function defense(s: GameState, p: PlayerState, attack: PendingAttack): GameAction {
  const usable = handOf(p).filter((h) => blocks(h.def, attack.element));
  const plain = usable.filter((h) => !h.def.reflect && !h.def.evade).sort((a, b) => (b.def.defense ?? 0) - (a.def.defense ?? 0));
  const raw = damageFor(attack, 0);
  const lethal = raw >= p.vida;

  const mirror = usable.find((h) => h.def.reflect);
  if (mirror && (raw >= 7 || lethal)) return { type: "defender", cards: [mirror.inst.uid] };

  // Junta defesas da maior para a menor até zerar o golpe; poupa a mão quando o golpe é fraco.
  const picked: string[] = [];
  let total = 0;
  for (const h of plain) {
    if (total >= attack.power) break;
    picked.push(h.inst.uid);
    total += h.def.defense ?? 0;
  }
  const left = damageFor(attack, total);
  if (picked.length > 0 && (raw >= 3 || lethal)) {
    if (left >= p.vida) {
      const dodge = usable.find((h) => h.def.evade);
      if (dodge) return { type: "defender", cards: [dodge.inst.uid] };
    }
    return { type: "defender", cards: picked };
  }
  const dodge = usable.find((h) => h.def.evade);
  if (dodge && (lethal || raw >= 9)) return { type: "defender", cards: [dodge.inst.uid] };
  return { type: "defender", cards: [] };
}

/** A decisão do bot para a fase atual. */
export function botAction(s: GameState, pid: string): GameAction {
  const p = s.players[pid];
  const phase = s.phase;
  if (phase.type === "defesa") return defense(s, p, phase.attack);
  if (phase.type === "mercado") {
    const affordable = phase.offer
      .map((inst) => ({ inst, def: card(inst.id) }))
      .filter((o) => o.def.price <= p.ouro && p.hand.length < HAND_MAX)
      .sort((a, b) => b.def.price - a.def.price);
    return { type: "comprar", offer: affordable[0]?.inst.uid ?? null };
  }
  const hand = handOf(p);
  if (p.vida <= 16) {
    const h = heal(s, p, hand);
    if (h) return h;
  }
  const u = utility(s, p, hand);
  if (u && (u.type !== "usar" || noise(s, 5) < 0.7)) return u;
  return attackPlan(s, p, hand) ?? u ?? { type: "orar" };
}
