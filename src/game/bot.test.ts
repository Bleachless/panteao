import { describe, expect, it } from "vitest";
import { botAction } from "./bot";
import { applyAction, createGame, currentDecider, HAND_MAX } from "./engine";
import type { GameState } from "./types";

function botsGame(n: number, seed: number): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  return createGame(players, { seed, now: 0 });
}

describe("bots", () => {
  it("jogam partidas inteiras sem jogadas inválidas", () => {
    let finished = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const n = 2 + (seed % 5);
      let s = botsGame(n, seed);
      let steps = 0;
      while (s.phase.type !== "fim" && steps < 3000) {
        const who = currentDecider(s)!;
        s = applyAction(s, who, botAction(s, who), steps * 1000);
        steps++;
        for (const p of Object.values(s.players)) {
          expect(p.hand.length).toBeLessThanOrEqual(HAND_MAX);
          if (!p.alive) expect(p.hand).toHaveLength(0);
        }
      }
      if (s.phase.type === "fim") {
        finished++;
        const alive = Object.values(s.players).filter((p) => p.alive);
        expect(alive.length).toBeLessThanOrEqual(1);
        expect(s.phase.winner).toBe(alive[0]?.id ?? null);
      }
    }
    // O Crepúsculo garante que toda partida termina.
    expect(finished).toBe(150);
  });

  it("defende um golpe letal quando pode", () => {
    let s = botsGame(2, 7);
    const attacker = s.active;
    const defender = s.order.find((id) => id !== attacker)!;
    s.players[attacker].hand = [{ uid: "w", id: "machado" }];
    s.players[defender].hand = [{ uid: "d1", id: "broquel" }, { uid: "d2", id: "egide" }];
    s.players[defender].vida = 6;
    s = applyAction(s, attacker, { type: "atacar", weapon: "w", target: defender }, 0);
    const action = botAction(s, defender);
    expect(action).toEqual({ type: "defender", cards: ["d2"] });
  });

  it("cura quando está mal", () => {
    const s = botsGame(2, 9);
    const me = s.active;
    s.players[me].vida = 8;
    s.players[me].hand = [{ uid: "a", id: "ambrosia" }, { uid: "w", id: "lanca" }];
    expect(botAction(s, me)).toEqual({ type: "usar", card: "a" });
  });

  it("ora quando não tem o que fazer", () => {
    const s = botsGame(2, 11);
    const me = s.active;
    s.players[me].hand = [{ uid: "d", id: "broquel" }];
    expect(botAction(s, me)).toEqual({ type: "orar" });
  });
});
