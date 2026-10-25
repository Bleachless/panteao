import { botAction } from "./bot";
import { applyAction, createGame, currentDecider, GameError, timeoutAction, viewFor } from "./engine";
import type { GameAction, GameSettings, GameState, GameView } from "./types";

// A sala: saguão, assentos, bots e a partida em andamento. Também é puro: o servidor carrega, aplica e salva.

export const MAX_SEATS = 6;
export const NAME_MAX = 16;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export type Ritmo = "normal" | "rapido" | "livre";
export const RITMOS: Record<Ritmo, { label: string; settings: GameSettings }> = {
  normal: { label: "Normal (40s)", settings: { actionSeconds: 40, defenseSeconds: 25 } },
  rapido: { label: "Rápido (20s)", settings: { actionSeconds: 20, defenseSeconds: 12 } },
  livre: { label: "Sem relógio", settings: { actionSeconds: null, defenseSeconds: null } },
};

export interface Seat {
  id: string;
  name: string;
  bot: boolean;
  /** Índice do brasão (símbolo e cor) do deus. */
  sigil: number;
  tokenHash?: string;
}

export interface Room {
  code: string;
  mode: "sala" | "treino";
  createdAt: number;
  hostId: string;
  seats: Seat[];
  status: "saguao" | "jogo";
  ritmo: Ritmo;
  game: GameState | null;
  round: number;
  wins: Record<string, number>;
}

export interface SeatView {
  id: string;
  name: string;
  bot: boolean;
  sigil: number;
}

export interface RoomView {
  code: string;
  mode: Room["mode"];
  status: Room["status"];
  hostId: string;
  seats: SeatView[];
  ritmo: Ritmo;
  round: number;
  wins: Record<string, number>;
  game: GameView | null;
  you: string | null;
}

export const SIGIL_COUNT = 8;

const BOT_NAMES = ["Vórtice", "Aurélia", "Tharos", "Nyxa", "Solenne", "Kairon", "Brumália", "Ostrus", "Iridiel", "Zephra"];

export function cleanName(raw: unknown): string {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
  if (!name) throw new GameError("Escolha um nome para o seu deus.");
  return name;
}

export function isRoomCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code) && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

function uniqueName(room: Room, name: string): string {
  const taken = new Set(room.seats.map((s) => s.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name.slice(0, NAME_MAX - 2)} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function freeSigil(room: Room, preferred: number): number {
  const used = new Set(room.seats.map((s) => s.sigil));
  for (let i = 0; i < SIGIL_COUNT; i++) {
    const sigil = (preferred + i) % SIGIL_COUNT;
    if (!used.has(sigil)) return sigil;
  }
  return preferred % SIGIL_COUNT;
}

export function createRoom(opts: { code: string; host: { id: string; name: string; tokenHash: string }; mode?: Room["mode"]; now: number; sigil?: number }): Room {
  const room: Room = {
    code: opts.code,
    mode: opts.mode ?? "sala",
    createdAt: opts.now,
    hostId: opts.host.id,
    seats: [],
    status: "saguao",
    ritmo: opts.mode === "treino" ? "livre" : "normal",
    game: null,
    round: 0,
    wins: {},
  };
  room.seats.push({ id: opts.host.id, name: cleanName(opts.host.name), bot: false, sigil: (opts.sigil ?? 0) % SIGIL_COUNT, tokenHash: opts.host.tokenHash });
  return room;
}

export function joinRoom(room: Room, who: { id: string; name: string; tokenHash: string }, sigil = 0): Room {
  if (room.mode === "treino") throw new GameError("Essa é uma sala de treino.");
  if (room.status !== "saguao") throw new GameError("A partida já começou. Espere a próxima rodada.");
  if (room.seats.length >= MAX_SEATS) throw new GameError("A sala está cheia.");
  const next = structuredClone(room);
  next.seats.push({ id: who.id, name: uniqueName(next, cleanName(who.name)), bot: false, sigil: freeSigil(next, sigil), tokenHash: who.tokenHash });
  return next;
}

function hostOnly(room: Room, by: string) {
  if (room.hostId !== by) throw new GameError("Só quem criou a sala pode fazer isso.");
}

function lobbyOnly(room: Room) {
  if (room.status !== "saguao") throw new GameError("A partida já está rolando.");
}

export function addBot(room: Room, by: string, botId: string): Room {
  hostOnly(room, by);
  lobbyOnly(room);
  if (room.seats.length >= MAX_SEATS) throw new GameError("A sala está cheia.");
  const next = structuredClone(room);
  const used = new Set(next.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? uniqueName(next, "Oráculo");
  next.seats.push({ id: botId, name, bot: true, sigil: freeSigil(next, next.seats.length * 3) });
  return next;
}

export function removeSeat(room: Room, by: string, seatId: string): Room {
  hostOnly(room, by);
  lobbyOnly(room);
  if (seatId === by) throw new GameError("Para sair, use o botão Sair.");
  if (!room.seats.some((s) => s.id === seatId)) throw new GameError("Esse assento já está vazio.");
  const next = structuredClone(room);
  next.seats = next.seats.filter((s) => s.id !== seatId);
  return next;
}

export function setRitmo(room: Room, by: string, ritmo: Ritmo): Room {
  hostOnly(room, by);
  lobbyOnly(room);
  if (!(ritmo in RITMOS)) throw new GameError("Ritmo desconhecido.");
  return { ...structuredClone(room), ritmo };
}

/** Sair da sala. Devolve null quando não sobra nenhuma pessoa (a sala pode ser apagada). */
export function leaveRoom(room: Room, id: string, now: number): Room | null {
  let next = structuredClone(room);
  const seat = next.seats.find((s) => s.id === id);
  if (!seat) return next;
  if (next.status === "jogo" && next.game && next.game.phase.type !== "fim" && next.game.players[id]?.alive) {
    next = { ...next, game: applyAction(next.game, id, { type: "desistir" }, now) };
    countWin(next);
  }
  if (next.status === "saguao" || next.game?.phase.type === "fim") next.seats = next.seats.filter((s) => s.id !== id);
  else seat.tokenHash = undefined;
  const humans = next.seats.filter((s) => !s.bot && s.tokenHash);
  if (humans.length === 0) return null;
  if (next.hostId === id) next.hostId = humans[0].id;
  return next;
}

export function startGame(room: Room, by: string, seed: number, now: number): Room {
  hostOnly(room, by);
  if (room.status === "jogo" && room.game?.phase.type !== "fim") throw new GameError("A partida já está rolando.");
  const seats = room.seats.filter((s) => s.bot || s.tokenHash);
  if (seats.length < 2) throw new GameError("Chame mais alguém ou adicione um bot: são precisos dois deuses.");
  const next = structuredClone(room);
  next.seats = seats;
  next.status = "jogo";
  next.round++;
  next.game = createGame(
    seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot })),
    { seed, now, settings: RITMOS[next.ritmo].settings },
  );
  return next;
}

export function backToLobby(room: Room, by: string): Room {
  hostOnly(room, by);
  if (room.status !== "jogo" || room.game?.phase.type !== "fim") throw new GameError("A partida ainda não acabou.");
  const next = structuredClone(room);
  next.status = "saguao";
  next.game = null;
  next.seats = next.seats.filter((s) => s.bot || s.tokenHash);
  return next;
}

function countWin(room: Room) {
  const phase = room.game?.phase;
  if (phase?.type === "fim" && phase.winner) room.wins[phase.winner] = (room.wins[phase.winner] ?? 0) + 1;
}

export function playMove(room: Room, id: string, action: GameAction, now: number): Room {
  if (room.status !== "jogo" || !room.game) throw new GameError("Nenhuma partida em andamento.");
  const next = { ...room, wins: { ...room.wins }, game: applyAction(room.game, id, action, now) };
  countWin(next);
  return next;
}

/**
 * Faz o relógio andar: bots que terminaram de pensar jogam e quem estourou o tempo recebe a jogada padrão.
 * Devolve null quando nada mudou.
 */
export function tickRoom(room: Room, now: number): Room | null {
  let next: Room | null = null;
  for (let i = 0; i < 24; i++) {
    const game = (next ?? room).game;
    if (!game || game.phase.type === "fim" || game.deadline === null || now < game.deadline) break;
    const who = currentDecider(game)!;
    let action: GameAction | null = game.players[who].bot ? botAction(game, who) : timeoutAction(game);
    if (!action) break;
    let after: GameState;
    try {
      after = applyAction(game, who, action, now);
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      // Se o bot errar, ele joga o padrão em vez de travar a mesa.
      action = timeoutAction(game)!;
      after = applyAction(game, who, action, now);
    }
    next = { ...(next ?? room), wins: { ...(next ?? room).wins }, game: after };
    countWin(next);
  }
  return next;
}

export function roomView(room: Room, you: string | null): RoomView {
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    hostId: room.hostId,
    seats: room.seats.map(({ id, name, bot, sigil }) => ({ id, name, bot, sigil })),
    ritmo: room.ritmo,
    round: room.round,
    wins: room.wins,
    game: room.game ? viewFor(room.game, you) : null,
    you,
  };
}
