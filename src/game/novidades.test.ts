import { describe, expect, it } from "vitest";
import { chatAction, chatOptions, parseChat, tally } from "./chat";
import { GameError, viewFor } from "./engine";
import { narrate } from "./narrator";
import {
  addBot,
  addChatSeat,
  ARENA_MIN_SEATS,
  ARENA_WAIT_MS,
  createRoom,
  joinRoom,
  MAX_SEATS,
  playMove,
  replayStates,
  roomView,
  startGame,
  tickRoom,
  type Room,
} from "./room";
import type { LogEntry } from "./types";

function lobby(mode: Room["mode"] = "sala"): Room {
  return createRoom({ code: "ABCD", host: { id: "h", name: "Hera", tokenHash: "th" }, mode, now: 0 });
}

/** Deixa o relógio andar até a partida acabar. */
function runToEnd(room: Room): Room {
  let r = room;
  let now = 0;
  for (let i = 0; i < 4000 && r.game!.phase.type !== "fim"; i++) {
    now = Math.max(now, r.game!.deadline ?? now) + 1;
    r = tickRoom(r, now) ?? r;
  }
  return r;
}

describe("replays", () => {
  it("a semente e as jogadas reconstroem a partida inteira", () => {
    let r = addBot(addBot(lobby(), "h", "b1"), "h", "b2");
    r = startGame(r, "h", 77, 0, "rteste");
    r = playMove(r, "h", { type: "orar" }, 1);
    r = runToEnd(r);
    expect(r.game!.phase.type).toBe("fim");
    expect(r.record!.moves.length).toBeGreaterThan(5);
    const states = replayStates(r.record!);
    expect(states).toHaveLength(r.record!.moves.length + 1);
    expect(states[states.length - 1]).toEqual(r.game);
    expect(roomView(r, "h").replayId).toBe("rteste");
  });

  it("o replay só aparece quando a partida acaba", () => {
    let r = addBot(lobby(), "h", "b1");
    r = startGame(r, "h", 3, 0, "rx");
    expect(roomView(r, "h").replayId).toBeNull();
  });
});

describe("Arena", () => {
  it("espera, completa com bots e começa sozinha", () => {
    let r = lobby("arena");
    expect(r.startsAt).toBe(ARENA_WAIT_MS);
    r = joinRoom(r, { id: "a", name: "Ares", tokenHash: "ta" }, 0, 10);
    expect(tickRoom(r, ARENA_WAIT_MS - 1)).toBeNull();
    const started = tickRoom(r, ARENA_WAIT_MS, 9)!;
    expect(started.status).toBe("jogo");
    expect(started.seats).toHaveLength(ARENA_MIN_SEATS);
    expect(started.seats.filter((s) => s.bot)).toHaveLength(ARENA_MIN_SEATS - 2);
    expect(started.record).toBeTruthy();
  });

  it("qualquer deus sentado pode apressar, e ninguém mexe nos bots", () => {
    let r = lobby("arena");
    r = joinRoom(r, { id: "a", name: "Ares", tokenHash: "ta" }, 0, 10);
    expect(() => addBot(r, "h", "b1")).toThrow(/Arena/);
    r = startGame(r, "a", 1, 500);
    expect(r.startsAt).toBe(500);
    expect(tickRoom(r, 500, 3)!.status).toBe("jogo");
  });

  it("mesa cheia começa na hora", () => {
    let r = lobby("arena");
    for (let i = 1; i < MAX_SEATS; i++) r = joinRoom(r, { id: `p${i}`, name: `P${i}`, tokenHash: `t${i}` }, 0, 100);
    expect(r.startsAt).toBe(100);
  });
});

describe("assento do chat", () => {
  it("só o anfitrião cria, com canal válido e um por sala", () => {
    const r = joinRoom(lobby(), { id: "a", name: "Ares", tokenHash: "ta" });
    expect(() => addChatSeat(r, "a", "canal")).toThrow(/Só quem criou/);
    expect(() => addChatSeat(r, "h", "x!")).toThrow(/inválido/);
    const withChat = addChatSeat(r, "h", "#MeuCanal");
    expect(withChat.seats.find((s) => s.chat)).toMatchObject({ id: "chat", name: "Chat meucanal", chat: { channel: "meucanal", controller: "h" } });
    expect(() => addChatSeat(withChat, "h", "outro")).toThrow(/já tem/);
  });

  it("quem controla joga pelo chat e vê a mão dele", () => {
    let r = addChatSeat(lobby(), "h", "canal");
    r = startGame(r, "h", 5, 0, "rchat");
    expect(roomView(r, "h").controlled?.id).toBe("chat");
    expect(roomView(r, "h").controlled?.hand).toHaveLength(8);
    expect(roomView(r, "x").controlled).toBeNull();
    const chatTurn = r.game!.active === "chat" ? r : playMove(r, "h", { type: "orar" }, 1);
    expect(() => playMove(chatTurn, "outro", { type: "orar" }, 2, "chat")).toThrow(GameError);
    const after = playMove(chatTurn, "h", { type: "orar" }, 2, "chat");
    expect(after.game!.active).toBe("h");
  });
});

describe("comandos do chat", () => {
  let r = addBot(addBot(lobby(), "h", "b1"), "h", "b2");
  r = startGame(r, "h", 11, 0, "rc");
  const game = structuredClone(r.game!);
  game.phase = { type: "acao", player: "h" };
  game.active = "h";
  const view = viewFor(game, "h");

  it("lista as opções da vez", () => {
    const keys = chatOptions(view, "h").map((o) => o.key);
    expect(keys).toEqual(["atacar:b1", "atacar:b2", "curar", "orar", "oraculo"]);
    expect(chatOptions(view, "b1")).toEqual([]);
  });

  it("entende nomes sem acento, apelidos e números", () => {
    expect(parseChat("!atacar vort", view, "h")).toBe("atacar:b1");
    expect(parseChat("!ATACAR aurelia", view, "h")).toBe("atacar:b2");
    expect(parseChat("!2", view, "h")).toBe("atacar:b2");
    expect(parseChat("!rezar", view, "h")).toBe("orar");
    expect(parseChat("!bot", view, "h")).toBe("oraculo");
    expect(parseChat("!aceitar", view, "h")).toBeNull();
    expect(parseChat("bora atacar", view, "h")).toBeNull();
    expect(parseChat("!9", view, "h")).toBeNull();
  });

  it("conta um voto por pessoa e ordena", () => {
    expect(tally({ ana: "orar", bia: "atacar:b1", caio: "atacar:b1" })).toEqual([
      { key: "atacar:b1", count: 2 },
      { key: "orar", count: 1 },
    ]);
  });

  it("o voto vira uma jogada válida", () => {
    game.players.h.hand = [{ uid: "w", id: "machado" }, { uid: "a", id: "ambrosia" }];
    expect(chatAction(game, "h", "atacar:b2")).toEqual({ type: "atacar", weapon: "w", boosters: [], target: "b2" });
    expect(chatAction(game, "h", "orar")).toEqual({ type: "orar" });
    game.players.h.vida = 8;
    expect(chatAction(game, "h", "curar")).toEqual({ type: "usar", card: "a" });
  });
});

describe("narrador", () => {
  const names = { a: "Ares", b: "Bia" };
  const entry = (e: Partial<LogEntry>): LogEntry => ({ seq: 1, turn: 1, kind: "info", text: "", ...e });

  it("grita os lances grandes e fica quieto nos pequenos", () => {
    expect(narrate(entry({ kind: "prodigio", cards: ["hora-zero"], actor: "a" }), names)).toMatch(/HORA ZERO/);
    expect(narrate(entry({ kind: "vitoria", actor: "b" }), names)).toBe("ACABOU! BIA É O NOVO DONO DO PANTEÃO!");
    expect(narrate(entry({ kind: "defesa", target: "a", text: "Bia ergue o Espelho Celeste e devolve o golpe para Ares!" }), names)).toBe("ESPELHO! VOLTOU NA CARA DE ARES!");
    expect(narrate(entry({ kind: "queda", actor: "a", text: "A Sentença do Tártaro se cumpre: Ares cai na hora." }), names)).toMatch(/TÁRTARO/);
    expect(narrate(entry({ kind: "dano", target: "b", amount: 12 }), names)).toMatch(/12/);
    expect(narrate(entry({ kind: "dano", target: "b", amount: 3 }), names)).toBeNull();
    expect(narrate(entry({ kind: "turno", actor: "a", text: "Vez de Ares." }), names)).toBeNull();
  });
});
