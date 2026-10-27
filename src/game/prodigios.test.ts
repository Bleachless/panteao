import { describe, expect, it } from "vitest";
import { botAction } from "./bot";
import { card, CARDS, GUARDIANS } from "./cards";
import {
  applyAction,
  BLOOD_MOON_BONUS,
  createGame,
  DAMNATION_DAMAGE,
  GameError,
  GRACE_HEAL,
  HAND_MAX,
  HAND_SIZE,
  random,
  START,
  timeoutAction,
  viewFor,
} from "./engine";
import type { GameAction, GameState } from "./types";

function setup(n = 2, seed = 1): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Deus ${i + 1}`, bot: false }));
  return createGame(players, { seed, now: 0, first: "p1" });
}

function rig(s: GameState, pid: string, ids: string[]): string[] {
  s.players[pid].hand = ids.map((id, i) => ({ uid: `${pid}-${i}`, id }));
  return s.players[pid].hand.map((c) => c.uid);
}

/** Mão cheia: quem ora não compra, e o próximo sorteio fica para quem joga depois. */
function fullHand(s: GameState, pid: string) {
  rig(s, pid, Array.from({ length: HAND_MAX }, () => "broquel"));
}

function act(s: GameState, pid: string, action: GameAction) {
  return applyAction(s, pid, action, 1000);
}

/** Ajusta o gerador para que o próximo sorteio caia abaixo (ou acima) de um valor. */
function forceRoll(s: GameState, below: boolean, threshold: number) {
  for (let seed = 1; seed < 10_000; seed++) {
    const roll = random({ ...s, rng: seed });
    if (below ? roll < threshold : roll >= threshold) {
      s.rng = seed;
      return;
    }
  }
  throw new Error("semente não encontrada");
}

describe("guardiões", () => {
  it("a Ânfora invoca um guardião que fica do seu lado", () => {
    let s = setup();
    const [anfora] = rig(s, "p1", ["anfora"]);
    s = act(s, "p1", { type: "usar", card: anfora });
    const g = s.players.p1.guardian!;
    expect(GUARDIANS.map((x) => x.id)).toContain(g.id);
    expect(viewFor(s, "p2").players.p1.guardian).toEqual(g);
  });

  it("o Golem segura o dano dos golpes", () => {
    let s = setup();
    s.players.p2.guardian = { id: "golem", vida: 12 };
    const [machado] = rig(s, "p1", ["machado"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: machado, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.vida).toBe(START.vida);
    expect(s.players.p2.guardian).toEqual({ id: "golem", vida: 5 });
  });

  it("o Golem que se desfaz deixa passar o resto", () => {
    let s = setup();
    s.players.p2.guardian = { id: "golem", vida: 3 };
    const [machado] = rig(s, "p1", ["machado"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: machado, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.vida).toBe(START.vida - 4);
    expect(s.players.p2.guardian).toBeNull();
  });

  it("o Grifo ataca um inimigo no começo da vez do dono", () => {
    let s = setup();
    s.players.p2.guardian = { id: "grifo", vida: 8 };
    fullHand(s, "p1");
    forceRoll(s, true, 0.5);
    s = act(s, "p1", { type: "orar" });
    expect(s.players.p1.vida).toBe(START.vida - 4);
  });

  it("golpes em área ferem os guardiões", () => {
    let s = setup(3);
    s.players.p2.guardian = { id: "cervo", vida: 8 };
    const [flechas] = rig(s, "p1", ["flechas"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: flechas, target: "" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.guardian).toEqual({ id: "cervo", vida: 5 });
  });

  it("o Banimento desfaz o guardião do alvo e pede um alvo com guardião", () => {
    let s = setup();
    const [banimento] = rig(s, "p1", ["banimento"]);
    expect(() => act(s, "p1", { type: "usar", card: banimento, target: "p2" })).toThrow(/não tem guardião/);
    s.players.p2.guardian = { id: "salamandra", vida: 6 };
    s = act(s, "p1", { type: "usar", card: banimento, target: "p2" });
    expect(s.players.p2.guardian).toBeNull();
    expect(s.players.p1.fe).toBe(START.fe - 3);
  });
});

describe("prodígios", () => {
  it("todos os prodígios são raríssimos", () => {
    for (const c of CARDS.filter((x) => x.kind === "prodigio")) {
      expect(c.rarity).toBe(3);
      expect(c.weight).toBeLessThan(1);
    }
  });

  it("a Hora Zero deixa todo mundo com 1 de Vida", () => {
    let s = setup(3);
    const [hora] = rig(s, "p1", ["hora-zero"]);
    s = act(s, "p1", { type: "usar", card: hora });
    expect(["p1", "p2", "p3"].map((id) => s.players[id].vida)).toEqual([1, 1, 1]);
  });

  it("a Grande Conjunção dá um guardião a cada deus vivo", () => {
    let s = setup(3);
    const [conj] = rig(s, "p1", ["conjuncao"]);
    s = act(s, "p1", { type: "usar", card: conj });
    for (const id of ["p1", "p2", "p3"]) expect(s.players[id].guardian).toBeTruthy();
  });

  it("a Troca de Destinos troca as Vidas", () => {
    let s = setup();
    s.players.p1.vida = 5;
    const [destinos] = rig(s, "p1", ["destinos"]);
    s = act(s, "p1", { type: "usar", card: destinos, target: "p2" });
    expect([s.players.p1.vida, s.players.p2.vida]).toEqual([START.vida, 5]);
  });

  it("o Dilúvio renova a mão de todos", () => {
    let s = setup();
    const [diluvio] = rig(s, "p1", ["diluvio"]);
    rig(s, "p2", ["egide"]);
    s = act(s, "p1", { type: "usar", card: diluvio });
    expect(s.players.p1.hand).toHaveLength(HAND_SIZE);
    expect(s.players.p2.hand.some((c) => c.uid === "p2-0")).toBe(false);
  });

  it("a Lua de Sangue soma em todo golpe até se pôr", () => {
    let s = setup();
    const [lua, lanca] = rig(s, "p1", ["lua-de-sangue", "lanca"]);
    s = act(s, "p1", { type: "usar", card: lua });
    expect(s.phenomenon).toEqual({ id: "lua-de-sangue", untilRound: 4 });
    s = act(s, "p2", { type: "orar" });
    s = act(s, "p1", { type: "atacar", weapon: lanca, target: "p2" });
    expect(s.phase.type === "defesa" && s.phase.attack.power).toBe(5 + BLOOD_MOON_BONUS);
    s = act(s, "p2", { type: "defender", cards: [] });
    s.round = 5;
    s = act(s, "p2", { type: "orar" });
    expect(s.phenomenon).toBeNull();
  });
});

describe("céu e inferno", () => {
  it("a Sentença do Tártaro derruba quem não segura com Luz", () => {
    let s = setup(3);
    const [sentenca] = rig(s, "p1", ["sentenca"]);
    rig(s, "p2", ["escudo"]);
    s = act(s, "p1", { type: "atacar", weapon: sentenca, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.alive).toBe(false);
  });

  it("o Halo segura a Sentença", () => {
    let s = setup();
    const [sentenca] = rig(s, "p1", ["sentenca"]);
    const [halo] = rig(s, "p2", ["halo"]);
    s = act(s, "p1", { type: "atacar", weapon: sentenca, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [halo] });
    expect(s.players.p2.alive).toBe(true);
    expect(s.players.p2.vida).toBe(START.vida);
  });

  it("o Golem se sacrifica pela Sentença", () => {
    let s = setup();
    s.players.p2.guardian = { id: "golem", vida: 12 };
    const [sentenca] = rig(s, "p1", ["sentenca"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: sentenca, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.alive).toBe(true);
    expect(s.players.p2.guardian).toBeNull();
  });

  it("a Graça cura, mas pode levar ao céu", () => {
    let s = setup();
    const [escada] = rig(s, "p1", ["escada"]);
    s = act(s, "p1", { type: "usar", card: escada, target: "p2" });
    expect(s.players.p2.statuses[0].id).toBe("graca");
    // A vez de p2 começou com a cura da Graça.
    expect(s.players.p2.vida === START.vida + GRACE_HEAL || !s.players.p2.alive).toBe(true);

    const t = setup();
    t.players.p2.statuses = [{ id: "graca", turns: 3 }];
    fullHand(t, "p1");
    forceRoll(t, true, 0.2);
    const after = act(t, "p1", { type: "orar" });
    expect(after.players.p2.alive).toBe(false);
    expect(after.log.some((l) => l.text.includes("sobe aos céus"))).toBe(true);
  });

  it("a Danação queima e pode arrastar ao Tártaro", () => {
    const s = setup();
    s.players.p2.statuses = [{ id: "danacao", turns: 3 }];
    fullHand(s, "p1");
    const safe = structuredClone(s);
    forceRoll(safe, false, 0.15);
    expect(act(safe, "p1", { type: "orar" }).players.p2.vida).toBe(START.vida - DAMNATION_DAMAGE);
    const doomed = structuredClone(s);
    forceRoll(doomed, true, 0.15);
    expect(act(doomed, "p1", { type: "orar" }).players.p2.alive).toBe(false);
  });

  it("a Escada Celeste pode mirar você mesmo", () => {
    let s = setup();
    const [escada] = rig(s, "p1", ["escada"]);
    s = act(s, "p1", { type: "usar", card: escada, target: "p1" });
    expect(s.players.p1.statuses.map((st) => st.id)).toEqual(["graca"]);
  });

  it("o Pacto Infernal dá Fé com Danação", () => {
    let s = setup();
    const [pacto] = rig(s, "p1", ["pacto"]);
    s = act(s, "p1", { type: "usar", card: pacto });
    expect(s.players.p1.fe).toBe(START.fe + 15);
    expect(s.players.p1.statuses.map((st) => st.id)).toEqual(["danacao"]);
  });
});

describe("milagres roubados", () => {
  it("custam muita Fé", () => {
    for (const id of ["julgamento", "ira", "renascer", "cetro-tempo", "saque"]) expect(card(id).cost).toBeGreaterThanOrEqual(10);
    const s = setup();
    const [julgamento] = rig(s, "p1", ["julgamento"]);
    expect(() => act(s, "p1", { type: "usar", card: julgamento, target: "p2" })).toThrow(/Fé insuficiente/);
  });

  it("o Cetro do Tempo dá outra vez", () => {
    let s = setup();
    s.players.p1.fe = 20;
    const [cetro] = rig(s, "p1", ["cetro-tempo"]);
    s = act(s, "p1", { type: "usar", card: cetro });
    expect(s.phase).toEqual({ type: "acao", player: "p1" });
    s = act(s, "p1", { type: "orar" });
    expect(s.active).toBe("p2");
  });

  it("o Saque dos Céus leva três cartas", () => {
    let s = setup();
    s.players.p1.fe = 20;
    const [saque] = rig(s, "p1", ["saque"]);
    rig(s, "p2", ["egide", "halo", "espelho", "adaga"]);
    s = act(s, "p1", { type: "usar", card: saque, target: "p2" });
    expect(s.players.p1.hand).toHaveLength(4);
  });

  it("o Renascer devolve a Vida cheia", () => {
    let s = setup();
    s.players.p1.fe = 20;
    s.players.p1.vida = 3;
    s.players.p1.statuses = [{ id: "veneno", turns: 2 }];
    const [renascer] = rig(s, "p1", ["renascer"]);
    s = act(s, "p1", { type: "usar", card: renascer });
    expect(s.players.p1.vida).toBe(START.vida);
    expect(s.players.p1.statuses).toEqual([]);
  });
});

describe("escambo", () => {
  it("o alvo aceita e paga", () => {
    let s = setup();
    const [escambo, egide] = rig(s, "p1", ["escambo", "egide"]);
    s = act(s, "p1", { type: "escambo", card: escambo, item: egide, target: "p2", price: 8 });
    expect(s.phase.type).toBe("proposta");
    expect(() => act(s, "p1", { type: "responder", accept: true })).toThrow(GameError);
    s = act(s, "p2", { type: "responder", accept: true });
    expect([s.players.p1.ouro, s.players.p2.ouro]).toEqual([START.ouro + 8, START.ouro - 8]);
    expect(s.players.p2.hand.some((c) => c.uid === egide)).toBe(true);
  });

  it("recusar devolve a carta, e o tempo esgotado recusa", () => {
    let s = setup();
    const [escambo, egide] = rig(s, "p1", ["escambo", "egide"]);
    s = act(s, "p1", { type: "escambo", card: escambo, item: egide, target: "p2", price: 50 });
    expect(timeoutAction(s)).toEqual({ type: "responder", accept: false });
    expect(() => act(s, "p2", { type: "responder", accept: true })).toThrow(/Ouro insuficiente/);
    s = act(s, "p2", { type: "responder", accept: false });
    expect(s.players.p1.hand.some((c) => c.uid === egide)).toBe(true);
    expect(s.players.p1.ouro).toBe(START.ouro);
  });

  it("o bot aceita preço justo e recusa caro", () => {
    let s = setup();
    s.players.p2.bot = true;
    const [escambo, egide] = rig(s, "p1", ["escambo", "egide"]);
    const fair = act(s, "p1", { type: "escambo", card: escambo, item: egide, target: "p2", price: card("egide").price });
    expect(botAction(fair, "p2")).toEqual({ type: "responder", accept: true });
    s = act(s, "p1", { type: "escambo", card: escambo, item: egide, target: "p2", price: 19 });
    expect(botAction(s, "p2")).toEqual({ type: "responder", accept: false });
  });
});
