import { describe, expect, it } from "vitest";
import { card, CARDS } from "./cards";
import {
  applyAction,
  blocks,
  createGame,
  GameError,
  HAND_SIZE,
  random,
  START,
  timeoutAction,
  twilightDamage,
  viewFor,
} from "./engine";
import type { GameAction, GameState } from "./types";

function setup(n = 2, seed = 1): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Deus ${i + 1}`, bot: false }));
  return createGame(players, { seed, now: 0, first: "p1" });
}

/** Troca a mão de um jogador por cartas escolhidas e devolve os uids na mesma ordem. */
function rig(s: GameState, pid: string, ids: string[]): string[] {
  s.players[pid].hand = ids.map((id, i) => ({ uid: `${pid}-${i}`, id }));
  return s.players[pid].hand.map((c) => c.uid);
}

function act(s: GameState, pid: string, action: GameAction, now = 1000) {
  return applyAction(s, pid, action, now);
}

/** Ajusta o gerador para que o próximo sorteio caia abaixo (ou acima) de um valor. */
function forceRoll(s: GameState, below: boolean, threshold = 0.5) {
  for (let seed = 1; seed < 10_000; seed++) {
    const probe = { ...s, rng: seed };
    const roll = random(probe);
    if (below ? roll < threshold : roll >= threshold) {
      s.rng = seed;
      return;
    }
  }
  throw new Error("semente não encontrada");
}

describe("início da partida", () => {
  it("dá 8 cartas e os recursos iniciais para cada deus", () => {
    const s = setup(4);
    for (const id of s.order) {
      const p = s.players[id];
      expect(p.hand).toHaveLength(HAND_SIZE);
      expect([p.vida, p.fe, p.ouro]).toEqual([START.vida, START.fe, START.ouro]);
    }
    expect(s.phase).toEqual({ type: "acao", player: "p1" });
    expect(s.deadline).toBe(40_000);
  });

  it("é determinístico pela semente", () => {
    expect(setup(3, 42)).toEqual(setup(3, 42));
    expect(setup(3, 42).players.p1.hand).not.toEqual(setup(3, 43).players.p1.hand);
  });

  it("exige pelo menos dois deuses", () => {
    expect(() => createGame([{ id: "a", name: "A", bot: false }], { seed: 1, now: 0 })).toThrow(GameError);
  });

  it("todas as cartas têm nome, texto e números coerentes", () => {
    const ids = new Set<string>();
    for (const c of CARDS) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.weight).toBeGreaterThan(0);
      if (c.kind === "arma") expect(c.attack).toBeGreaterThan(0);
      if (c.kind === "defesa") expect(c.defense ?? c.reflect ?? c.evade).toBeTruthy();
      if (c.kind === "milagre") expect(c.cost).toBeGreaterThan(0);
    }
  });
});

describe("quem segura o quê", () => {
  it("segue a tabela de elementos", () => {
    expect(blocks(card("escudo"), "neutro")).toBe(true);
    expect(blocks(card("escudo"), "fogo")).toBe(false);
    expect(blocks(card("manto"), "fogo")).toBe(true);
    expect(blocks(card("manto"), "neutro")).toBe(true);
    expect(blocks(card("manto"), "mar")).toBe(false);
    expect(blocks(card("halo"), "abismo")).toBe(true);
    expect(blocks(card("escudo"), "abismo")).toBe(false);
    expect(blocks(card("halo"), "luz")).toBe(false);
    expect(blocks(card("espelho"), "luz")).toBe(false);
    expect(blocks(card("espelho"), "fogo")).toBe(true);
    expect(blocks(card("lanca"), "neutro")).toBe(false);
  });
});

describe("golpes e defesas", () => {
  it("o dano é o golpe menos a defesa", () => {
    let s = setup();
    const [lanca] = rig(s, "p1", ["lanca"]);
    const [escudo, broquel] = rig(s, "p2", ["broquel", "escudo"]).reverse();
    s = act(s, "p1", { type: "atacar", weapon: lanca, target: "p2" });
    expect(s.phase.type).toBe("defesa");
    expect(s.deadline).toBe(1000 + 25_000);
    s = act(s, "p2", { type: "defender", cards: [broquel] });
    expect(s.players.p2.vida).toBe(START.vida - 3);
    expect(s.players.p2.hand.map((c) => c.uid)).toContain(escudo);
    expect(s.players.p2.hand.map((c) => c.uid)).not.toContain(broquel);
    // A vez passa para o próximo, que repõe a mão.
    expect(s.phase).toEqual({ type: "acao", player: "p2" });
    expect(s.players.p2.hand).toHaveLength(HAND_SIZE);
  });

  it("defesa maior que o golpe zera o dano e não cura", () => {
    let s = setup();
    const [adaga] = rig(s, "p1", ["adaga"]);
    const [egide] = rig(s, "p2", ["egide"]);
    s = act(s, "p1", { type: "atacar", weapon: adaga, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [egide] });
    expect(s.players.p2.vida).toBe(START.vida);
  });

  it("golpe elemental só cai para defesa do mesmo elemento", () => {
    let s = setup();
    const [lamina] = rig(s, "p1", ["lamina"]);
    const [escudo, manto] = rig(s, "p2", ["escudo", "manto"]);
    s = act(s, "p1", { type: "atacar", weapon: lamina, target: "p2" });
    expect(() => act(s, "p2", { type: "defender", cards: [escudo] })).toThrow(GameError);
    s = act(s, "p2", { type: "defender", cards: [manto] });
    expect(s.players.p2.vida).toBe(START.vida - 2);
  });

  it("Luz não pode ser defendida", () => {
    let s = setup();
    const [aurora] = rig(s, "p1", ["aurora"]);
    const [halo] = rig(s, "p2", ["halo"]);
    s = act(s, "p1", { type: "atacar", weapon: aurora, target: "p2" });
    expect(() => act(s, "p2", { type: "defender", cards: [halo] })).toThrow(GameError);
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.vida).toBe(START.vida - 5);
  });

  it("Abismo sem defesa causa o dobro e só o Halo segura", () => {
    let s = setup();
    const [foice] = rig(s, "p1", ["foice"]);
    const [escudo] = rig(s, "p2", ["escudo"]);
    s = act(s, "p1", { type: "atacar", weapon: foice, target: "p2" });
    expect(() => act(s, "p2", { type: "defender", cards: [escudo] })).toThrow(GameError);
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.vida).toBe(START.vida - 12);

    let t = setup();
    const [foice2] = rig(t, "p1", ["foice"]);
    const [halo] = rig(t, "p2", ["halo"]);
    t = act(t, "p1", { type: "atacar", weapon: foice2, target: "p2" });
    t = act(t, "p2", { type: "defender", cards: [halo] });
    expect(t.players.p2.vida).toBe(START.vida);
  });

  it("reforços somam e podem mudar o elemento", () => {
    let s = setup();
    const [lanca, furia, brasa] = rig(s, "p1", ["lanca", "furia", "brasa"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: lanca, boosters: [furia, brasa], target: "p2" });
    if (s.phase.type !== "defesa") throw new Error("esperava defesa");
    expect(s.phase.attack.power).toBe(10);
    expect(s.phase.attack.element).toBe("fogo");
    expect(s.players.p1.hand).toHaveLength(0);
  });

  it("só aceita uma arma com reforços de verdade", () => {
    const s = setup();
    const [lanca, escudo] = rig(s, "p1", ["lanca", "escudo"]);
    expect(() => act(s, "p1", { type: "atacar", weapon: escudo, target: "p2" })).toThrow(GameError);
    expect(() => act(s, "p1", { type: "atacar", weapon: lanca, boosters: [escudo], target: "p2" })).toThrow(GameError);
    expect(() => act(s, "p1", { type: "atacar", weapon: lanca, target: "p1" })).toThrow(GameError);
  });

  it("o Espelho devolve o golpe e quem atacou pode se defender", () => {
    let s = setup();
    const [machado, escudo] = rig(s, "p1", ["machado", "escudo"]);
    const [espelho] = rig(s, "p2", ["espelho"]);
    s = act(s, "p1", { type: "atacar", weapon: machado, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [espelho] });
    expect(s.phase.type).toBe("defesa");
    expect(s.phase.type === "defesa" && s.phase.player).toBe("p1");
    s = act(s, "p1", { type: "defender", cards: [escudo] });
    expect(s.players.p1.vida).toBe(START.vida - 3);
    expect(s.players.p2.vida).toBe(START.vida);
  });

  it("o Espelho precisa ir sozinho", () => {
    let s = setup();
    const [machado] = rig(s, "p1", ["machado"]);
    const [espelho, escudo] = rig(s, "p2", ["espelho", "escudo"]);
    s = act(s, "p1", { type: "atacar", weapon: machado, target: "p2" });
    expect(() => act(s, "p2", { type: "defender", cards: [espelho, escudo] })).toThrow(GameError);
  });

  it("o Passo Etéreo esquiva com sorte e falha sem ela", () => {
    let s = setup();
    const [machado] = rig(s, "p1", ["machado"]);
    const [passo] = rig(s, "p2", ["passo"]);
    s = act(s, "p1", { type: "atacar", weapon: machado, target: "p2" });
    const lucky = structuredClone(s);
    forceRoll(lucky, true);
    expect(act(lucky, "p2", { type: "defender", cards: [passo] }).players.p2.vida).toBe(START.vida);
    const unlucky = structuredClone(s);
    forceRoll(unlucky, false);
    expect(act(unlucky, "p2", { type: "defender", cards: [passo] }).players.p2.vida).toBe(START.vida - 7);
  });

  it("golpe em área passa por todos os outros, na ordem da mesa", () => {
    let s = setup(4);
    const [flechas] = rig(s, "p1", ["flechas"]);
    for (const id of ["p2", "p3", "p4"]) rig(s, id, []);
    s = act(s, "p1", { type: "atacar", weapon: flechas, target: "" });
    const seen: string[] = [];
    while (s.phase.type === "defesa") {
      seen.push(s.phase.player);
      s = act(s, s.phase.player, { type: "defender", cards: [] });
    }
    expect(seen).toEqual(["p2", "p3", "p4"]);
    expect([s.players.p2.vida, s.players.p3.vida, s.players.p4.vida]).toEqual([33, 33, 33]);
    expect(s.phase).toEqual({ type: "acao", player: "p2" });
  });
});

describe("Crepúsculo", () => {
  it("começa na volta 8 e aperta a cada volta", () => {
    expect([1, 7, 8, 9, 12].map(twilightDamage)).toEqual([0, 0, 1, 2, 5]);
  });

  it("conta as voltas e tira Vida no começo da vez", () => {
    let s = setup();
    expect(s.round).toBe(1);
    s = act(s, "p1", { type: "orar" });
    s = act(s, "p2", { type: "orar" });
    expect(s.round).toBe(2);
    s.round = 9;
    s = act(s, "p1", { type: "orar" });
    expect(s.players.p2.vida).toBe(START.vida - 2);
  });
});

describe("mazelas", () => {
  it("o veneno tira Vida no começo da vez", () => {
    let s = setup();
    const [dardo] = rig(s, "p1", ["dardo"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: dardo, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    // 2 do dardo + 2 do veneno logo no começo da vez dele.
    expect(s.players.p2.vida).toBe(START.vida - 4);
    expect(s.players.p2.statuses).toEqual([{ id: "veneno", turns: 3 }]);
  });

  it("o veneno pode derrubar", () => {
    let s = setup(3);
    s.players.p2.vida = 2;
    s.players.p2.statuses = [{ id: "veneno", turns: 2 }];
    s = act(s, "p1", { type: "orar" });
    expect(s.players.p2.alive).toBe(false);
    expect(s.phase).toEqual({ type: "acao", player: "p3" });
  });

  it("quem dorme perde a vez", () => {
    let s = setup(3);
    const [cetro] = rig(s, "p1", ["cetro"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: cetro, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.phase).toEqual({ type: "acao", player: "p3" });
    expect(s.players.p2.statuses).toEqual([]);
    expect(s.players.p2.hand).toHaveLength(HAND_SIZE);
  });

  it("o Silêncio impede milagres", () => {
    let s = setup();
    const [silencio] = rig(s, "p1", ["silencio"]);
    s = act(s, "p1", { type: "usar", card: silencio, target: "p2" });
    expect(s.players.p1.fe).toBe(START.fe - 3);
    const [cura] = rig(s, "p2", ["cura"]);
    expect(() => act(s, "p2", { type: "usar", card: cura })).toThrow(/Silêncio/);
  });
});

describe("milagres, itens e trocas", () => {
  it("milagre gasta Fé e volta para a mão; item some", () => {
    let s = setup();
    s.players.p1.vida = 20;
    const [cura, ambrosia] = rig(s, "p1", ["cura", "ambrosia"]);
    s = act(s, "p1", { type: "usar", card: cura });
    expect(s.players.p1.vida).toBe(30);
    expect(s.players.p1.fe).toBe(START.fe - 4);
    // p2 joga e a vez volta para p1.
    s = act(s, "p2", { type: "orar" });
    expect(s.players.p1.hand.some((c) => c.uid === cura)).toBe(true);
    s = act(s, "p1", { type: "usar", card: ambrosia });
    expect(s.players.p1.vida).toBe(42);
    expect(s.players.p1.hand.some((c) => c.uid === ambrosia)).toBe(false);
  });

  it("sem Fé, sem milagre", () => {
    const s = setup();
    s.players.p1.fe = 3;
    const [cura] = rig(s, "p1", ["cura"]);
    expect(() => act(s, "p1", { type: "usar", card: cura })).toThrow(/Fé insuficiente/);
  });

  it("o Relâmpago vira um golpe de Luz", () => {
    let s = setup();
    const [relampago] = rig(s, "p1", ["relampago"]);
    s = act(s, "p1", { type: "usar", card: relampago, target: "p2" });
    expect(s.phase.type === "defesa" && s.phase.attack.element).toBe("luz");
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.vida).toBe(START.vida - 6);
  });

  it("o Furto leva uma carta do alvo", () => {
    let s = setup();
    const [furto] = rig(s, "p1", ["furto"]);
    rig(s, "p2", ["egide"]);
    s = act(s, "p1", { type: "usar", card: furto, target: "p2" });
    expect(s.players.p1.hand.map((c) => c.id).sort()).toEqual(["egide", "furto"]);
  });

  it("o mercado mostra 3 relíquias e cobra em Ouro", () => {
    let s = setup();
    const [mercado] = rig(s, "p1", ["mercado"]);
    s = act(s, "p1", { type: "usar", card: mercado });
    if (s.phase.type !== "mercado") throw new Error("esperava mercado");
    expect(s.phase.offer).toHaveLength(3);
    expect(viewFor(s, "p2").phase).toMatchObject({ type: "mercado", offer: null });
    const cheap = s.phase.offer.find((c) => card(c.id).price <= START.ouro)!;
    const after = act(s, "p1", { type: "comprar", offer: cheap.uid });
    expect(after.players.p1.ouro).toBe(START.ouro - card(cheap.id).price);
    expect(after.players.p1.hand.some((c) => c.uid === cheap.uid)).toBe(true);

    s.players.p1.ouro = 0;
    expect(() => act(s, "p1", { type: "comprar", offer: cheap.uid })).toThrow(/Ouro insuficiente/);
  });

  it("o Penhorista paga o preço da carta", () => {
    let s = setup();
    const [penhor, egide] = rig(s, "p1", ["penhor", "egide"]);
    s = act(s, "p1", { type: "vender", card: penhor, item: egide });
    expect(s.players.p1.ouro).toBe(START.ouro + card("egide").price);
  });

  it("a Alquimia redistribui mantendo a soma", () => {
    let s = setup();
    const [balanca] = rig(s, "p1", ["alquimia"]);
    expect(() => act(s, "p1", { type: "alquimia", card: balanca, vida: 70, fe: 0, ouro: 1 })).toThrow(/soma/);
    expect(() => act(s, "p1", { type: "alquimia", card: balanca, vida: 0, fe: 50, ouro: 20 })).toThrow(/Vida/);
    s = act(s, "p1", { type: "alquimia", card: balanca, vida: 56, fe: 10, ouro: 0 });
    expect([s.players.p1.vida, s.players.p1.fe, s.players.p1.ouro]).toEqual([56, 10, 0]);
  });
});

describe("turnos e vitória", () => {
  it("só quem tem a vez joga, e jogada inválida não muda nada", () => {
    const s = setup();
    const before = structuredClone(s);
    expect(() => act(s, "p2", { type: "orar" })).toThrow(/sua vez/);
    expect(() => act(s, "p1", { type: "defender", cards: [] })).toThrow(GameError);
    expect(s).toEqual(before);
  });

  it("orar compra uma carta e passa a vez", () => {
    let s = setup();
    s = act(s, "p1", { type: "orar" });
    expect(s.players.p1.hand).toHaveLength(HAND_SIZE + 1);
    expect(s.active).toBe("p2");
  });

  it("pula quem caiu e termina com o último de pé", () => {
    let s = setup(3);
    s.players.p2.vida = 4;
    s.players.p3.vida = 4;
    const [lanca] = rig(s, "p1", ["lanca"]);
    rig(s, "p2", []);
    s = act(s, "p1", { type: "atacar", weapon: lanca, target: "p2" });
    s = act(s, "p2", { type: "defender", cards: [] });
    expect(s.players.p2.alive).toBe(false);
    expect(s.players.p2.fallen).toBe(1);
    expect(s.active).toBe("p3");
    const [lanca3] = rig(s, "p3", ["lanca"]);
    s.players.p1.vida = 3;
    rig(s, "p1", []);
    s = act(s, "p3", { type: "atacar", weapon: lanca3, target: "p1" });
    s = act(s, "p1", { type: "defender", cards: [] });
    expect(s.phase).toEqual({ type: "fim", winner: "p3" });
    expect(s.deadline).toBeNull();
    expect(() => act(s, "p3", { type: "orar" })).toThrow(/acabou/);
  });

  it("desistir derruba na hora e passa a vez", () => {
    let s = setup(3);
    s = act(s, "p1", { type: "desistir" });
    expect(s.players.p1.alive).toBe(false);
    expect(s.active).toBe("p2");
    s = act(s, "p3", { type: "desistir" });
    expect(s.phase).toEqual({ type: "fim", winner: "p2" });
  });

  it("quem desiste no meio da defesa deixa o golpe seguir", () => {
    let s = setup(3);
    const [flechas] = rig(s, "p1", ["flechas"]);
    s = act(s, "p1", { type: "atacar", weapon: flechas, target: "" });
    s = act(s, "p2", { type: "desistir" });
    expect(s.phase.type === "defesa" && s.phase.player).toBe("p3");
  });

  it("o tempo esgotado tem uma jogada padrão", () => {
    let s = setup();
    expect(timeoutAction(s)).toEqual({ type: "orar" });
    const [lanca] = rig(s, "p1", ["lanca"]);
    s = act(s, "p1", { type: "atacar", weapon: lanca, target: "p2" });
    expect(timeoutAction(s)).toEqual({ type: "defender", cards: [] });
  });
});

describe("visão de cada jogador", () => {
  it("mostra só a própria mão", () => {
    const s = setup(3);
    const view = viewFor(s, "p2");
    expect(view.me?.hand).toEqual(s.players.p2.hand);
    expect(view.players.p1).not.toHaveProperty("hand");
    expect(view.players.p1.handCount).toBe(HAND_SIZE);
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(s.players.p1.hand[0]));
    expect(viewFor(s, null).me).toBeNull();
  });
});
