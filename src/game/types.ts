// Tipos do jogo. Tudo aqui é dado puro (serializável em JSON) para caber no Redis e viajar pela rede.

export type Element = "neutro" | "fogo" | "mar" | "vento" | "luz" | "abismo";
export type Kind = "arma" | "reforco" | "defesa" | "milagre" | "item" | "troca";
export type StatusId = "veneno" | "sono" | "silencio";
export type Rarity = 1 | 2 | 3;

export type Effect =
  | { type: "cura"; amount: number }
  | { type: "fe"; amount: number }
  | { type: "ouro"; amount: number }
  | { type: "purificar"; heal?: number }
  | { type: "profecia"; amount: number }
  | { type: "ataque"; amount: number; element: Element; area?: boolean }
  | { type: "mazela"; status: StatusId; turns: number }
  | { type: "furto" }
  | { type: "comprar" }
  | { type: "vender" }
  | { type: "alquimia" };

export interface CardDef {
  id: string;
  name: string;
  kind: Kind;
  element: Element;
  rarity: Rarity;
  /** Peso no sorteio: quanto maior, mais comum. */
  weight: number;
  /** Preço no Mercado Celeste (e quanto o Penhorista paga). */
  price: number;
  text: string;
  flavor: string;
  attack?: number;
  /** A arma atinge todos os outros deuses vivos. */
  area?: boolean;
  defense?: number;
  /** Arma que aplica uma mazela quando causa dano. */
  inflict?: { status: StatusId; turns: number };
  /** Defesa que devolve o golpe para quem atacou. */
  reflect?: boolean;
  /** Defesa que faz o golpe errar com essa chance (0 a 1). */
  evade?: number;
  /** Reforço: soma ao ataque da arma. */
  boost?: number;
  /** Reforço que muda o elemento do golpe. */
  convert?: Element;
  /** Milagre: custo em Fé. */
  cost?: number;
  effect?: Effect;
  /** Quem a carta pode mirar ao ser usada. */
  target?: "self" | "other";
}

export interface CardInst {
  uid: string;
  id: string;
}

export interface StatusInst {
  id: StatusId;
  turns: number;
}

export interface PlayerState {
  id: string;
  name: string;
  bot: boolean;
  vida: number;
  fe: number;
  ouro: number;
  hand: CardInst[];
  statuses: StatusInst[];
  alive: boolean;
  /** Ordem de queda: 1 = primeiro a cair. */
  fallen?: number;
}

export interface PendingAttack {
  /** Quem desferiu o golpe (muda quando ele é refletido). */
  from: string;
  /** As cartas que formam o golpe, para a mesa mostrar. */
  cards: CardInst[];
  label: string;
  power: number;
  element: Element;
  inflict?: { status: StatusId; turns: number };
  /** Quem está se defendendo agora. */
  current: string;
  /** Próximos alvos de um golpe em área. */
  queue: string[];
  reflected: number;
}

export type Phase =
  | { type: "acao"; player: string }
  | { type: "defesa"; player: string; attack: PendingAttack }
  | { type: "mercado"; player: string; offer: CardInst[] }
  | { type: "fim"; winner: string | null };

export type LogKind =
  | "turno"
  | "ataque"
  | "defesa"
  | "dano"
  | "cura"
  | "milagre"
  | "item"
  | "troca"
  | "mazela"
  | "queda"
  | "oracao"
  | "vitoria"
  | "crepusculo"
  | "info";

export interface LogEntry {
  seq: number;
  turn: number;
  kind: LogKind;
  text: string;
  actor?: string;
  target?: string;
  amount?: number;
  element?: Element;
  cards?: string[];
}

export interface GameSettings {
  /** Segundos para agir na sua vez; null = sem limite. */
  actionSeconds: number | null;
  defenseSeconds: number | null;
}

export interface GameState {
  rng: number;
  turn: number;
  /** Volta da mesa: sobe quando a vez passa de novo pelo começo da ordem. */
  round: number;
  order: string[];
  /** Dono da vez atual. */
  active: string;
  phase: Phase;
  players: Record<string, PlayerState>;
  /** Momento (ms) em que a decisão atual vence: o tempo acaba ou o bot age. */
  deadline: number | null;
  settings: GameSettings;
  nextUid: number;
  fallenCount: number;
  log: LogEntry[];
  logSeq: number;
}

export type GameAction =
  | { type: "atacar"; weapon: string; boosters?: string[]; target: string }
  | { type: "usar"; card: string; target?: string }
  | { type: "vender"; card: string; item: string }
  | { type: "alquimia"; card: string; vida: number; fe: number; ouro: number }
  | { type: "orar" }
  | { type: "defender"; cards: string[] }
  | { type: "comprar"; offer: string | null }
  | { type: "desistir" };

/** O que cada navegador recebe: a própria mão e só a contagem das mãos alheias. */
export interface PlayerView extends Omit<PlayerState, "hand"> {
  handCount: number;
}

export interface GameView {
  turn: number;
  round: number;
  order: string[];
  active: string;
  phase:
    | { type: "acao"; player: string }
    | { type: "defesa"; player: string; attack: PendingAttack }
    | { type: "mercado"; player: string; offer: CardInst[] | null }
    | { type: "fim"; winner: string | null };
  players: Record<string, PlayerView>;
  deadline: number | null;
  settings: GameSettings;
  log: LogEntry[];
  me: { id: string; hand: CardInst[] } | null;
}
