import "server-only";
import { GameError } from "@/game/engine";
import {
  addBot,
  backToLobby,
  CODE_ALPHABET,
  createRoom,
  joinRoom,
  leaveRoom,
  playMove,
  removeSeat,
  roomView,
  setRitmo,
  startGame,
  tickRoom,
  type Ritmo,
  type Room,
  type RoomView,
} from "@/game/room";
import type { GameAction } from "@/game/types";
import { publish, realtimeKind } from "./notify";
import { getStore } from "./store";

// A ponte entre as rotas HTTP e o jogo puro: carrega a sala, aplica, grava com a versão e avisa a mesa.

export class NotFound extends Error {}

export interface RoomResponse {
  view: RoomView;
  version: number;
  realtime: "ably" | "sse";
  /** Relógio do servidor, para o navegador acertar a contagem regressiva. */
  now: number;
}

function randomId(prefix: string) {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] | 0;
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString("base64url");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function seatFor(room: Room, token: string | null): Promise<string | null> {
  if (!token) return null;
  const hash = await hashToken(token);
  return room.seats.find((s) => s.tokenHash === hash)?.id ?? null;
}

function respond(room: Room, version: number, you: string | null): RoomResponse {
  return { view: roomView(room, you), version, realtime: realtimeKind(), now: Date.now() };
}

/** Carrega, aplica `change` e grava; tenta de novo se outra jogada chegou antes. */
async function mutate(code: string, change: (room: Room, now: number) => Room | null | undefined): Promise<{ room: Room | null; version: number }> {
  const store = getStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store.load(code);
    if (!current) throw new NotFound("Sala não encontrada.");
    const now = Date.now();
    // Antes de qualquer jogada, o relógio anda: bots e tempos vencidos entram primeiro.
    const ticked = tickRoom(current.room, now) ?? current.room;
    const next = change(ticked, now);
    if (next === null) {
      await store.remove(code);
      await publish(code, current.version + 1);
      return { room: null, version: current.version + 1 };
    }
    const final = next ?? ticked;
    if (final === current.room) return current;
    const version = await store.save(code, final, current.version);
    if (version !== null) {
      await publish(code, version);
      return { room: final, version };
    }
  }
  throw new GameError("A mesa está agitada demais. Tente de novo.");
}

export async function createNewRoom(input: { name: string; mode: Room["mode"]; bots: number; sigil: number }) {
  const store = getStore();
  const token = newToken();
  const tokenHash = await hashToken(token);
  const hostId = randomId("d");
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const now = Date.now();
    let room = createRoom({ code, host: { id: hostId, name: input.name, tokenHash }, mode: input.mode, now, sigil: input.sigil });
    if (input.mode === "treino") {
      for (let i = 0; i < input.bots; i++) room = addBot(room, hostId, randomId("bot"));
      room = startGame(room, hostId, randomSeed(), now);
    }
    const version = await store.save(code, room, 0);
    if (version !== null) return { code, token, you: hostId, ...respond(room, version, hostId) };
  }
  throw new GameError("Não consegui abrir uma sala agora. Tente de novo.");
}

export async function getRoom(code: string, token: string | null): Promise<RoomResponse> {
  const store = getStore();
  const current = await store.load(code);
  if (!current) throw new NotFound("Sala não encontrada.");
  let { room, version } = current;
  // Ler a sala também faz o relógio andar: é assim que os bots jogam sem um servidor ligado o tempo todo.
  const ticked = tickRoom(room, Date.now());
  if (ticked) {
    const saved = await store.save(code, ticked, version);
    if (saved !== null) {
      await publish(code, saved);
      room = ticked;
      version = saved;
    } else {
      const fresh = await store.load(code);
      if (!fresh) throw new NotFound("Sala não encontrada.");
      ({ room, version } = fresh);
    }
  }
  return respond(room, version, await seatFor(room, token));
}

export type RoomOp =
  | { op: "entrar"; nome: string; brasao?: number }
  | { op: "sair" }
  | { op: "bot" }
  | { op: "remover"; assento: string }
  | { op: "ritmo"; ritmo: Ritmo }
  | { op: "comecar" }
  | { op: "saguao" }
  | { op: "jogada"; acao: GameAction }
  | { op: "relogio" };

export async function operate(code: string, token: string | null, body: RoomOp): Promise<RoomResponse & { token?: string; you?: string }> {
  if (body.op === "entrar") {
    const existing = await getRoom(code, token);
    if (existing.view.you) return existing;
    const fresh = newToken();
    const tokenHash = await hashToken(fresh);
    const id = randomId("d");
    const { room, version } = await mutate(code, (r) => joinRoom(r, { id, name: body.nome, tokenHash }, Number(body.brasao) || 0));
    return { ...respond(room!, version, id), token: fresh, you: id };
  }

  const store = getStore();
  const current = await store.load(code);
  if (!current) throw new NotFound("Sala não encontrada.");
  const you = await seatFor(current.room, token);
  if (!you && body.op !== "relogio") throw new GameError("Entre na sala antes de jogar.");
  const me = you!;

  const { room, version } = await mutate(code, (r, now) => {
    switch (body.op) {
      case "sair":
        return leaveRoom(r, me, now);
      case "bot":
        return addBot(r, me, randomId("bot"));
      case "remover":
        return removeSeat(r, me, String(body.assento));
      case "ritmo":
        return setRitmo(r, me, body.ritmo);
      case "comecar":
        return startGame(r, me, randomSeed(), now);
      case "saguao":
        return backToLobby(r, me);
      case "jogada":
        return playMove(r, me, parseAction(body.acao), now);
      case "relogio":
        return undefined;
      default:
        throw new GameError("Operação desconhecida.");
    }
  });
  if (!room) return { view: { ...roomView(current.room, null), seats: [] }, version, realtime: realtimeKind(), now: Date.now() };
  return respond(room, version, you);
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : []);
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : NaN);

/** Confere o formato da jogada que veio da rede; as regras ficam por conta do motor. */
export function parseAction(raw: unknown): GameAction {
  const a = (raw ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case "atacar":
      return { type: "atacar", weapon: str(a.weapon), boosters: strList(a.boosters), target: str(a.target) };
    case "usar":
      return { type: "usar", card: str(a.card), target: a.target ? str(a.target) : undefined };
    case "vender":
      return { type: "vender", card: str(a.card), item: str(a.item) };
    case "alquimia":
      return { type: "alquimia", card: str(a.card), vida: int(a.vida), fe: int(a.fe), ouro: int(a.ouro) };
    case "orar":
      return { type: "orar" };
    case "defender":
      return { type: "defender", cards: strList(a.cards) };
    case "comprar":
      return { type: "comprar", offer: a.offer ? str(a.offer) : null };
    case "desistir":
      return { type: "desistir" };
    default:
      throw new GameError("Jogada desconhecida.");
  }
}
