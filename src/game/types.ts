// Tipos do jogo. Tudo aqui é dado puro (serializável em JSON) para caber no Redis e viajar pela rede.

export type Element = "neutro" | "fogo" | "mar" | "vento" | "luz" | "abismo";
export type Kind = "arma" | "reforco" | "defesa" | "milagre" | "item" | "troca" | "prodigio";
export type StatusId = "veneno" | "sono" | "silencio" | "graca" | "danacao";
export type Rarity = 1 | 2 | 3;

export type Effect =
  | { type: "cura"; amount: number }
  | { type: "fe"; amount: number }
  | { type: "ouro"; amount: number }
  | { type: "purificar"; heal?: number }
  | { type: "profecia"; amount: number }
  | { type: "ataque"; amount: number; element: Element; area?: boolean }
  | { type: "mazela"; status: StatusId; turns: number }
  | { type: "furto"; amount?: number }
  | { type: "renascer" }
  | { type: "turno-extra" }
  | { type: "pacto"; fe: number; status: StatusId; turns: number }
  | { type: "comprar" }
  | { type: "vender" }
  | { type: "alquimia" }
  | { type: "escambo" }
  | { type: "invocar"; guardian?: GuardianId }
  | { type: "banir" }
  | { type: "hora-zero" }
  | { type: "conjuncao" }
  | { type: "destinos" }
  | { type: "diluvio" }
  | { type: "fenomeno"; phenomenon: PhenomenonId; rounds: number };

export type GuardianId = "grifo" | "salamandra" | "cervo" | "golem" | "serpente" | "coruja" | "tartaruga";
export type PhenomenonId = "lua-de-sangue";

/** O que o guardião faz no começo da vez do dono (quando a sorte deixa). */
export type GuardianAct =
  | { type: "golpe"; amount: number; element: Element }
  | { type: "cura"; amount: number }
  | { type: "fe"; amount: number }
  | { type: "ouro"; amount: number }
  | { type: "veneno"; turns: number }
  /** Não age: segura o dano que iria para o dono. */
  | { type: "escudo" };

export interface GuardianDef {
  id: GuardianId;
  name: string;
  element: Element;
  vida: number;
  /** Chance de agir no começo da vez do dono (0 a 1). */
  chance: number;
  act: GuardianAct;
  text: string;
}

export interface GuardianInst {
  id: GuardianId;
  vida: number;
}

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
  /** Quem a carta pode mirar ao ser usada ("any" inclui você). */
  target?: "self" | "other" | "any";
  /** Golpe que derruba na hora se não for segurado. */
  lethal?: boolean;
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
  /** O companheiro invocado, se houver. */
  guardian?: GuardianInst | null;
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
  lethal?: boolean;
  /** Golpe em área: também fere os guardiões. */
  area?: boolean;
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
  | { type: "proposta"; player: string; trade: Trade }
  | { type: "fim"; winner: string | null };

/** Uma proposta de escambo: quem oferece, a carta e quanto Ouro pede por ela. */
export interface Trade {
  from: string;
  item: CardInst;
  price: number;
}

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
  | "guardiao"
  | "prodigio"
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
  /** Quem abriu a partida: a volta sobe quando a vez passa de novo por esse lugar da mesa. */
  starter: string;
  phase: Phase;
  players: Record<string, PlayerState>;
  /** Momento (ms) em que a decisão atual vence: o tempo acaba ou o bot age. */
  deadline: number | null;
  settings: GameSettings;
  nextUid: number;
  fallenCount: number;
  /** Quem joga de novo assim que a vez acabar (Cetro do Tempo). */
  extraTurn?: string | null;
  /** Fenômeno que vale para a mesa inteira até o fim de uma volta. */
  phenomenon: { id: PhenomenonId; untilRound: number } | null;
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
  | { type: "escambo"; card: string; item: string; target: string; price: number }
  | { type: "responder"; accept: boolean }
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
    | { type: "proposta"; player: string; trade: Trade }
    | { type: "fim"; winner: string | null };
  phenomenon: GameState["phenomenon"];
  players: Record<string, PlayerView>;
  deadline: number | null;
  settings: GameSettings;
  log: LogEntry[];
  me: { id: string; hand: CardInst[] } | null;
}
