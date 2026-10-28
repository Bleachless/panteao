import { botAction } from "./bot";
import { applyAction, createGame, currentDecider, GameError, timeoutAction, viewFor, type NewPlayer } from "./engine";
import type { CardInst, GameAction, GameSettings, GameState, GameView } from "./types";

// A sala: saguão, assentos, bots e a partida em andamento. Também é puro: o servidor carrega, aplica e salva.
// Toda jogada aplicada fica gravada: com a semente e a lista de jogadas, qualquer partida pode ser reassistida.

export const MAX_SEATS = 6;
export const NAME_MAX = 16;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Na Arena, quanto tempo o saguão espera mais gente antes de completar com bots e começar. */
export const ARENA_WAIT_MS = 20_000;
/** Na Arena, a mesa começa com pelo menos estes deuses (bots completam). */
export const ARENA_MIN_SEATS = 4;

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
  /** Assento jogado pelo chat da Twitch: quem abriu a sala envia o voto vencedor. */
  chat?: { channel: string; controller: string };
}

export interface ReplayMove {
  p: string;
  a: GameAction;
  t: number;
}

/** Tudo o que é preciso para reconstruir uma partida jogada por jogada. */
export interface Replay {
  id: string;
  createdAt: number;
  seed: number;
  now: number;
  settings: GameSettings;
  players: NewPlayer[];
  sigils: Record<string, number>;
  moves: ReplayMove[];
}

export interface Room {
  code: string;
  mode: "sala" | "treino" | "arena";
  createdAt: number;
  hostId: string;
  seats: Seat[];
  status: "saguao" | "jogo";
  ritmo: Ritmo;
  game: GameState | null;
  round: number;
  wins: Record<string, number>;
  /** Arena: quando a partida começa sozinha. */
  startsAt?: number | null;
  /** A gravação da partida atual. */
  record?: Replay | null;
}

export interface SeatView {
  id: string;
  name: string;
  bot: boolean;
  sigil: number;
  chat?: string;
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
  startsAt: number | null;
  /** O replay da partida que acabou (só aparece no fim). */
  replayId: string | null;
  /** O assento do chat que você controla, com a mão dele. */
  controlled: { id: string; hand: CardInst[] } | null;
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

/** Quem conta como gente na mesa: tem token (ainda está na sala). */
function humans(room: Room): Seat[] {
  return room.seats.filter((s) => !s.bot && !s.chat && s.tokenHash);
}

export function createRoom(opts: { code: string; host: { id: string; name: string; tokenHash: string }; mode?: Room["mode"]; now: number; sigil?: number }): Room {
  const mode = opts.mode ?? "sala";
  const room: Room = {
    code: opts.code,
    mode,
    createdAt: opts.now,
    hostId: opts.host.id,
    seats: [],
    status: "saguao",
    ritmo: mode === "treino" ? "livre" : "normal",
    game: null,
    round: 0,
    wins: {},
    startsAt: mode === "arena" ? opts.now + ARENA_WAIT_MS : null,
    record: null,
  };
  room.seats.push({ id: opts.host.id, name: cleanName(opts.host.name), bot: false, sigil: (opts.sigil ?? 0) % SIGIL_COUNT, tokenHash: opts.host.tokenHash });
  return room;
}

export function joinRoom(room: Room, who: { id: string; name: string; tokenHash: string }, sigil = 0, now?: number): Room {
  if (room.mode === "treino") throw new GameError("Essa é uma sala de treino.");
  if (room.status !== "saguao") throw new GameError("A partida já começou. Espere a próxima rodada.");
  if (room.seats.length >= MAX_SEATS) throw new GameError("A sala está cheia.");
  const next = structuredClone(room);
  next.seats.push({ id: who.id, name: uniqueName(next, cleanName(who.name)), bot: false, sigil: freeSigil(next, sigil), tokenHash: who.tokenHash });
  // Arena cheia não espera o relógio.
  if (next.mode === "arena" && next.seats.length >= MAX_SEATS && now !== undefined) next.startsAt = now;
  return next;
}

function hostOnly(room: Room, by: string) {
  if (room.mode === "arena") throw new GameError("Na Arena, a mesa se monta sozinha.");
  if (room.hostId !== by) throw new GameError("Só quem criou a sala pode fazer isso.");
}

function lobbyOnly(room: Room) {
  if (room.status !== "saguao") throw new GameError("A partida já está rolando.");
}

function pushBot(room: Room, botId: string) {
  const used = new Set(room.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? uniqueName(room, "Oráculo");
  room.seats.push({ id: botId, name, bot: true, sigil: freeSigil(room, room.seats.length * 3) });
}

export function addBot(room: Room, by: string, botId: string): Room {
  hostOnly(room, by);
  lobbyOnly(room);
  if (room.seats.length >= MAX_SEATS) throw new GameError("A sala está cheia.");
  const next = structuredClone(room);
  pushBot(next, botId);
  return next;
}

/** Um assento para o chat da Twitch: quem abriu a sala recebe os votos e manda a jogada. */
export function addChatSeat(room: Room, by: string, rawChannel: string): Room {
  hostOnly(room, by);
  lobbyOnly(room);
  const channel = String(rawChannel ?? "")
    .trim()
    .replace(/^@|^#/, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{3,25}$/.test(channel)) throw new GameError("Canal da Twitch inválido.");
  if (room.seats.some((s) => s.chat)) throw new GameError("A sala já tem um assento do chat.");
  if (room.seats.length >= MAX_SEATS) throw new GameError("A sala está cheia.");
  const next = structuredClone(room);
  next.seats.push({ id: "chat", name: `Chat ${channel}`, bot: false, sigil: freeSigil(next, 5), chat: { channel, controller: by } });
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

/** Aplica uma jogada e grava no replay. */
function apply(room: Room, who: string, action: GameAction, now: number): Room {
  const game = applyAction(room.game!, who, action, now);
  const record = room.record ? { ...room.record, moves: [...room.record.moves, { p: who, a: action, t: now }] } : room.record;
  const next = { ...room, wins: { ...room.wins }, game, record };
  countWin(next);
  return next;
}

/** Sair da sala. Devolve null quando não sobra nenhuma pessoa (a sala pode ser apagada). */
export function leaveRoom(room: Room, id: string, now: number): Room | null {
  let next = structuredClone(room);
  if (!next.seats.some((s) => s.id === id)) return next;
  if (next.status === "jogo" && next.game && next.game.phase.type !== "fim" && next.game.players[id]?.alive) {
    next = apply(next, id, { type: "desistir" }, now);
  }
  const seat = next.seats.find((s) => s.id === id)!;
  if (next.status === "saguao" || next.game?.phase.type === "fim") next.seats = next.seats.filter((s) => s.id !== id);
  else seat.tokenHash = undefined;
  // O chat sai junto com quem o controlava, se a partida não estiver rolando.
  if (next.status === "saguao") next.seats = next.seats.filter((s) => s.chat?.controller !== id);
  const people = humans(next);
  if (people.length === 0) return null;
  if (next.hostId === id) next.hostId = people[0].id;
  return next;
}

export function startGame(room: Room, by: string, seed: number, now: number, replayId = `r${seed >>> 0}`): Room {
  if (room.mode === "arena") {
    if (!room.seats.some((s) => s.id === by)) throw new GameError("Você não está nesta mesa.");
    lobbyOnly(room);
    // Na Arena, qualquer deus sentado pode apressar o começo.
    return { ...structuredClone(room), startsAt: now };
  }
  hostOnly(room, by);
  return begin(room, seed, now, replayId);
}

function begin(room: Room, seed: number, now: number, replayId: string): Room {
  if (room.status === "jogo" && room.game?.phase.type !== "fim") throw new GameError("A partida já está rolando.");
  const seats = room.seats.filter((s) => s.bot || s.tokenHash || s.chat);
  if (seats.length < 2) throw new GameError("Chame mais alguém ou adicione um bot: são precisos dois deuses.");
  const next = structuredClone(room);
  next.seats = seats;
  next.status = "jogo";
  next.round++;
  next.startsAt = null;
  const players = seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot }));
  const settings = RITMOS[next.ritmo].settings;
  next.game = createGame(players, { seed, now, settings });
  next.record = { id: replayId, createdAt: now, seed, now, settings, players, sigils: Object.fromEntries(seats.map((s) => [s.id, s.sigil])), moves: [] };
  return next;
}

export function backToLobby(room: Room, by: string): Room {
  hostOnly(room, by);
  if (room.status !== "jogo" || room.game?.phase.type !== "fim") throw new GameError("A partida ainda não acabou.");
  const next = structuredClone(room);
  next.status = "saguao";
  next.game = null;
  next.seats = next.seats.filter((s) => s.bot || s.tokenHash || s.chat);
  return next;
}

function countWin(room: Room) {
  const phase = room.game?.phase;
  if (phase?.type === "fim" && phase.winner) room.wins[phase.winner] = (room.wins[phase.winner] ?? 0) + 1;
}

/** Quem pode jogar por um assento: o próprio dono, ou quem controla o assento do chat. */
export function canActAs(room: Room, by: string, seatId: string): boolean {
  if (by === seatId) return true;
  return room.seats.find((s) => s.id === seatId)?.chat?.controller === by;
}

export function playMove(room: Room, id: string, action: GameAction, now: number, as: string = id): Room {
  if (room.status !== "jogo" || !room.game) throw new GameError("Nenhuma partida em andamento.");
  if (!canActAs(room, id, as)) throw new GameError("Você não joga por esse assento.");
  return apply(room, as, action, now);
}

/**
 * Faz o relógio andar: a Arena começa sozinha, bots que terminaram de pensar jogam e quem estourou o tempo
 * recebe a jogada padrão. Devolve null quando nada mudou.
 */
export function tickRoom(room: Room, now: number, seed = 0): Room | null {
  let next: Room | null = null;
  if (room.mode === "arena" && room.status === "saguao" && room.startsAt != null && now >= room.startsAt && humans(room).length > 0) {
    const filled = structuredClone(room);
    for (let i = 0; filled.seats.length < ARENA_MIN_SEATS; i++) pushBot(filled, `bot${room.round}${i}${filled.seats.length}`);
    next = begin(filled, seed || (now | 0), now, `r${(seed || now) >>> 0}`);
  }
  for (let i = 0; i < 24; i++) {
    const current = next ?? room;
    const game = current.game;
    if (!game || game.phase.type === "fim" || game.deadline === null || now < game.deadline) break;
    const who = currentDecider(game)!;
    let action: GameAction | null = game.players[who].bot ? botAction(game, who) : timeoutAction(game);
    if (!action) break;
    try {
      next = apply(current, who, action, now);
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      // Se o bot errar, ele joga o padrão em vez de travar a mesa.
      action = timeoutAction(game)!;
      next = apply(current, who, action, now);
    }
  }
  return next;
}

/** Reconstrói todos os estados de uma partida gravada, do primeiro ao último. */
export function replayStates(replay: Replay): GameState[] {
  let state = createGame(replay.players, { seed: replay.seed, now: replay.now, settings: replay.settings });
  const states = [state];
  for (const m of replay.moves) {
    state = applyAction(state, m.p, m.a, m.t);
    states.push(state);
  }
  return states;
}

export function roomView(room: Room, you: string | null): RoomView {
  const controlled = you && room.game ? room.seats.find((s) => s.chat?.controller === you) : undefined;
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    hostId: room.hostId,
    seats: room.seats.map(({ id, name, bot, sigil, chat }) => ({ id, name, bot, sigil, ...(chat ? { chat: chat.channel } : {}) })),
    ritmo: room.ritmo,
    round: room.round,
    wins: room.wins,
    game: room.game ? viewFor(room.game, you) : null,
    you,
    startsAt: room.startsAt ?? null,
    replayId: room.game?.phase.type === "fim" && room.record ? room.record.id : null,
    controlled: controlled && room.game?.players[controlled.id] ? { id: controlled.id, hand: room.game.players[controlled.id].hand } : null,
  };
}
