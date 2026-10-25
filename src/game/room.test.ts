import { describe, expect, it } from "vitest";
import { GameError } from "./engine";
import {
  addBot,
  backToLobby,
  cleanName,
  createRoom,
  isRoomCode,
  joinRoom,
  leaveRoom,
  MAX_SEATS,
  playMove,
  removeSeat,
  roomView,
  setRitmo,
  startGame,
  tickRoom,
  type Room,
} from "./room";

function lobby(): Room {
  return createRoom({ code: "ABCD", host: { id: "h", name: "Hera", tokenHash: "th" }, now: 0 });
}

describe("saguão", () => {
  it("limpa nomes e recusa nome vazio", () => {
    expect(cleanName("  Zeus   <b>do</b>  Trovão  ")).toBe("Zeus bdo/b Trovã");
    expect(() => cleanName("   ")).toThrow(GameError);
  });

  it("valida o código da sala", () => {
    expect(isRoomCode("ABCD")).toBe(true);
    expect(isRoomCode("ABC1")).toBe(false);
    expect(isRoomCode("ABCO")).toBe(false);
  });

  it("entra com nome único e brasão livre", () => {
    let r = lobby();
    r = joinRoom(r, { id: "a", name: "Hera", tokenHash: "ta" });
    expect(r.seats.map((s) => s.name)).toEqual(["Hera", "Hera 2"]);
    expect(new Set(r.seats.map((s) => s.sigil)).size).toBe(2);
  });

  it("enche até 6 e depois recusa", () => {
    let r = lobby();
    for (let i = 1; i < MAX_SEATS; i++) r = addBot(r, "h", `b${i}`);
    expect(r.seats).toHaveLength(MAX_SEATS);
    expect(() => joinRoom(r, { id: "x", name: "X", tokenHash: "tx" })).toThrow(/cheia/);
  });

  it("só quem criou mexe nos bots e no ritmo", () => {
    let r = joinRoom(lobby(), { id: "a", name: "Ares", tokenHash: "ta" });
    expect(() => addBot(r, "a", "b1")).toThrow(/Só quem criou/);
    r = addBot(r, "h", "b1");
    r = removeSeat(r, "h", "b1");
    expect(r.seats).toHaveLength(2);
    expect(setRitmo(r, "h", "rapido").ritmo).toBe("rapido");
  });

  it("passa a coroa quando quem criou sai e some quando não sobra ninguém", () => {
    let r = joinRoom(lobby(), { id: "a", name: "Ares", tokenHash: "ta" });
    r = addBot(r, "h", "b1");
    r = leaveRoom(r, "h", 0)!;
    expect(r.hostId).toBe("a");
    expect(leaveRoom(r, "a", 0)).toBeNull();
  });
});

describe("partida na sala", () => {
  it("começa com dois deuses e não deixa entrar no meio", () => {
    let r = lobby();
    expect(() => startGame(r, "h", 1, 0)).toThrow(/dois deuses/);
    r = addBot(r, "h", "b1");
    r = startGame(r, "h", 1, 0);
    expect(r.status).toBe("jogo");
    expect(r.round).toBe(1);
    expect(() => joinRoom(r, { id: "x", name: "X", tokenHash: "tx" })).toThrow(/já começou/);
  });

  it("o relógio faz o bot jogar depois de pensar", () => {
    let r = addBot(lobby(), "h", "b1");
    r = startGame(r, "h", 3, 0);
    // Força a vez do bot.
    if (r.game!.active === "h") r = playMove(r, "h", { type: "orar" }, 0);
    const deadline = r.game!.deadline!;
    expect(tickRoom(r, deadline - 1)).toBeNull();
    const after = tickRoom(r, deadline)!;
    expect(after.game!.logSeq).toBeGreaterThan(r.game!.logSeq);
  });

  it("tempo esgotado de uma pessoa vira oração", () => {
    let r = addBot(lobby(), "h", "b1");
    r = startGame(r, "h", 3, 0);
    while (r.game!.active !== "h" || r.game!.phase.type !== "acao") r = tickRoom(r, r.game!.deadline!)!;
    const before = r.game!.players.h.hand.length;
    r = tickRoom(r, r.game!.deadline!)!;
    expect(r.game!.log.some((l) => l.kind === "oracao" && l.actor === "h")).toBe(true);
    expect(r.game!.players.h.hand.length).toBeGreaterThanOrEqual(Math.min(before + 1, 12));
  });

  it("uma partida só de bots anda até o fim pelo relógio e conta a vitória", () => {
    let r = createRoom({ code: "ABCD", host: { id: "h", name: "Hera", tokenHash: "th" }, now: 0 });
    r = addBot(addBot(r, "h", "b1"), "h", "b2");
    r = startGame(r, "h", 5, 0);
    r = playMove(r, "h", { type: "desistir" }, 0);
    let now = 0;
    for (let i = 0; i < 2000 && r.game!.phase.type !== "fim"; i++) {
      now = Math.max(now, r.game!.deadline ?? now);
      r = tickRoom(r, now) ?? r;
    }
    const phase = r.game!.phase;
    expect(phase.type).toBe("fim");
    if (phase.type === "fim" && phase.winner) expect(r.wins[phase.winner]).toBe(1);
    r = backToLobby(r, "h");
    expect(r.status).toBe("saguao");
  });

  it("quem sai no meio desiste, mas o assento fica até o fim", () => {
    let r = joinRoom(lobby(), { id: "a", name: "Ares", tokenHash: "ta" });
    r = addBot(r, "h", "b1");
    r = startGame(r, "h", 9, 0);
    r = leaveRoom(r, "a", 0)!;
    expect(r.game!.players.a.alive).toBe(false);
    expect(r.seats.some((s) => s.id === "a")).toBe(true);
  });

  it("a visão esconde os tokens e as mãos alheias", () => {
    let r = addBot(lobby(), "h", "b1");
    r = startGame(r, "h", 9, 0);
    const v = roomView(r, "h");
    expect(JSON.stringify(v)).not.toContain("tokenHash");
    expect(v.game!.me!.id).toBe("h");
    expect(v.game!.players.b1).not.toHaveProperty("hand");
  });
});
