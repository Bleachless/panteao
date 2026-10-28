import type { LogEntry } from "./types";

// O narrador: transforma os lances da crônica em gritos de locutor. Só os lances que merecem viram fala;
// o resto passa em silêncio para ele não atropelar a partida.

const up = (s: string | undefined) => (s ?? "alguém").toLocaleUpperCase("pt-BR");

function pick(seq: number, lines: string[]) {
  return lines[seq % lines.length];
}

export function narrate(entry: LogEntry, names: Record<string, string>): string | null {
  const A = up(entry.actor ? names[entry.actor] : undefined);
  const T = up(entry.target ? names[entry.target] : undefined);
  const amount = entry.amount ?? 0;
  const text = entry.text;
  const card = entry.cards?.[0];

  switch (entry.kind) {
    case "vitoria":
      return entry.actor ? `ACABOU! ${A} É O NOVO DONO DO PANTEÃO!` : "ACABOU! NÃO SOBROU NINGUÉM PRA CONTAR A HISTÓRIA!";
    case "prodigio":
      if (card === "hora-zero") return "É A HORA ZERO! TODO MUNDO COM UM DE VIDA, MINHA GENTE!";
      if (card === "conjuncao") return "OS ASTROS SE ALINHARAM! TEM GUARDIÃO PRA TODO MUNDO!";
      if (card === "destinos") return `${A} TROCOU DE DESTINO COM ${T}! QUE ATREVIMENTO!`;
      if (card === "diluvio") return "É O DILÚVIO! LEVOU A MÃO DE TODO MUNDO!";
      if (card === "lua-de-sangue") return "A LUA DE SANGUE SUBIU! AGORA TODO GOLPE DÓI MAIS!";
      if (text.includes("joga de novo")) return `${A} JOGA DE NOVO! O TEMPO É DELE!`;
      return null;
    case "queda":
      if (text.includes("Sentença")) return `A SENTENÇA SE CUMPRIU! ${A} DESCEU PRO TÁRTARO!`;
      if (text.includes("céus")) return `${A} SUBIU AOS CÉUS E NÃO VOLTA MAIS!`;
      if (text.includes("Tártaro") || text.includes("Danação")) return `O TÁRTARO LEVOU ${A}!`;
      if (text.includes("Crepúsculo")) return `O CREPÚSCULO ENGOLIU ${A}!`;
      if (text.includes("desistiu")) return `${A} JOGOU A TOALHA!`;
      return pick(entry.seq, [`CAIU! ${A} VIROU ESTRELA!`, `ADEUS, ${A}! MAIS UMA ESTRELA NO CÉU!`, `${A} ESTÁ FORA DO PANTEÃO!`]);
    case "ataque":
      if (card === "sentenca") return `${A} PUXOU A SENTENÇA DO TÁRTARO! ${T}, OU TEM LUZ OU ACABOU!`;
      if (amount >= 12) return `OLHA O TAMANHO DISSO! ${A} VEM COM ${amount} EM CIMA DE ${entry.target ? T : "TODO MUNDO"}!`;
      if (!entry.target) return pick(entry.seq, [`${A} ATACA A MESA INTEIRA!`, `ATENÇÃO, TODO MUNDO! ${A} NÃO ESCOLHEU ALVO!`]);
      if (entry.element === "luz") return `RAIO DE LUZ EM ${T}! ESSE NINGUÉM SEGURA!`;
      if (amount >= 8) return pick(entry.seq, [`${A} PARTE PRA CIMA DE ${T}!`, `LÁ VEM ${A}! ${amount} DE GOLPE EM ${T}!`]);
      return null;
    case "defesa":
      if (text.includes("Espelho")) return `ESPELHO! VOLTOU NA CARA DE ${T}!`;
      if (text.includes("passa direto")) return `SUMIU! ${A} DESVIOU NO ÚLTIMO SEGUNDO!`;
      if (text.includes("golpe inteiro")) return pick(entry.seq, [`SEGUROU TUDO! ${T} NEM SENTIU!`, `DEFESAÇA DE ${T}!`]);
      return null;
    case "dano":
      if (amount >= 10) return pick(entry.seq, [`QUE PANCADA! ${T} SENTIU ${amount}!`, `${amount} NA CONTA DE ${T}! VAI DOER AMANHÃ!`]);
      return null;
    case "cura":
      return amount >= 10 ? `${A} SE LEVANTA! MAIS ${amount} DE VIDA!` : null;
    case "crepusculo":
      return amount >= 3 ? "O CREPÚSCULO NÃO PERDOA NINGUÉM!" : null;
    case "guardiao":
      return text.includes(" invoca ") && !text.includes("Conjunção") ? `${A} CHAMOU REFORÇO!` : null;
    case "troca":
      return text.includes("aceita:") ? `NEGÓCIO FECHADO! ${A} PAGOU ${amount}!` : null;
    default:
      return null;
  }
}
