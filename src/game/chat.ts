import { attackPlan, botAction, defense, heal } from "./bot";
import { card } from "./cards";
import type { GameAction, GameState, GameView } from "./types";

// O chat da Twitch como um deus: cada mensagem vira um voto ("!atacar vortice", "!orar", "!2"),
// o voto mais pedido vira uma jogada de verdade. Os comandos dizem a intenção; os detalhes (qual arma,
// quais defesas) ficam com a mesma cabeça dos bots.

export interface ChatOption {
  key: string;
  label: string;
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** As escolhas que fazem sentido agora para o assento do chat, numeradas para a votação. */
export function chatOptions(view: GameView, seat: string): ChatOption[] {
  const phase = view.phase;
  if (phase.type === "fim" || phase.player !== seat) return [];
  switch (phase.type) {
    case "acao": {
      const foes = view.order.filter((id) => id !== seat && view.players[id].alive);
      return [
        ...foes.map((id) => ({ key: `atacar:${id}`, label: `!atacar ${view.players[id].name}` })),
        { key: "curar", label: "!curar" },
        { key: "orar", label: "!orar" },
        { key: "oraculo", label: "!oraculo (o Oráculo decide)" },
      ];
    }
    case "defesa":
      return [
        { key: "defender", label: "!defender" },
        { key: "receber", label: "!receber" },
      ];
    case "proposta":
      return [
        { key: "aceitar", label: `!aceitar (${phase.trade.price} de Ouro)` },
        { key: "recusar", label: "!recusar" },
      ];
    case "mercado":
      return [
        ...(phase.offer ?? []).map((c, i) => ({ key: `comprar:${i + 1}`, label: `!comprar ${i + 1} (${card(c.id).name})` })),
        { key: "sair", label: "!sair" },
      ];
  }
}

const ALIASES: Record<string, string> = {
  curar: "curar",
  cura: "curar",
  orar: "orar",
  rezar: "orar",
  oraculo: "oraculo",
  bot: "oraculo",
  defender: "defender",
  defende: "defender",
  receber: "receber",
  aceitar: "aceitar",
  sim: "aceitar",
  recusar: "recusar",
  nao: "recusar",
  sair: "sair",
};

/** Lê uma mensagem do chat e devolve a chave da opção votada (ou null se não for voto válido agora). */
export function parseChat(text: string, view: GameView, seat: string): string | null {
  const options = chatOptions(view, seat);
  if (options.length === 0) return null;
  const msg = normalize(text);
  if (!msg.startsWith("!")) return null;
  const [word, ...rest] = msg.slice(1).split(/\s+/);
  const arg = rest.join(" ");
  const valid = (key: string) => (options.some((o) => o.key === key) ? key : null);

  // "!2" vota na segunda opção da lista.
  if (/^\d+$/.test(word)) return options[Number(word) - 1]?.key ?? null;
  if (word === "atacar" || word === "atk") {
    const foes = options.filter((o) => o.key.startsWith("atacar:"));
    if (foes.length === 1 && !arg) return foes[0].key;
    const hit = foes.find((o) => normalize(view.players[o.key.slice(7)].name).startsWith(arg)) ?? foes.find((o) => arg && normalize(view.players[o.key.slice(7)].name).includes(arg));
    return arg ? (hit?.key ?? null) : null;
  }
  if (word === "comprar") return valid(`comprar:${Number(arg) || 1}`);
  return ALIASES[word] ? valid(ALIASES[word]) : null;
}

/** Conta os votos (um por pessoa) e devolve do mais votado para o menos. */
export function tally(votes: Record<string, string>): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const key of Object.values(votes)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

/** Transforma o voto vencedor numa jogada. Sem voto (ou voto que não cabe), o Oráculo decide. */
export function chatAction(s: GameState, seat: string, key: string | null): GameAction {
  const p = s.players[seat];
  const phase = s.phase;
  if (!key || phase.type === "fim" || phase.player !== seat) return botAction(s, seat);
  const [cmd, arg] = key.split(":");
  switch (phase.type) {
    case "acao":
      if (cmd === "atacar" && s.players[arg]?.alive && arg !== seat) return attackPlan(s, p, undefined, s.players[arg]) ?? { type: "orar" };
      if (cmd === "curar") return heal(s, p) ?? botAction(s, seat);
      if (cmd === "orar") return { type: "orar" };
      break;
    case "defesa":
      if (cmd === "receber") return { type: "defender", cards: [] };
      if (cmd === "defender") return defense(s, p, phase.attack);
      break;
    case "proposta":
      if (cmd === "aceitar") return { type: "responder", accept: p.ouro >= phase.trade.price };
      if (cmd === "recusar") return { type: "responder", accept: false };
      break;
    case "mercado": {
      if (cmd === "sair") return { type: "comprar", offer: null };
      const pick = phase.offer[Number(arg) - 1];
      if (cmd === "comprar") return { type: "comprar", offer: pick && card(pick.id).price <= p.ouro ? pick.uid : null };
      break;
    }
  }
  return botAction(s, seat);
}
