import type { CardDef, Element, GuardianDef, GuardianId, Kind } from "./types";

// O Códice: todas as relíquias do Panteão. Nomes, números e textos são originais deste jogo.
export const CARDS: CardDef[] = [
  // Armas comuns (golpe neutro: qualquer defesa segura)
  { id: "adaga", name: "Adaga de Bronze", kind: "arma", element: "neutro", rarity: 1, weight: 10, price: 3, attack: 3, text: "Golpe 3.", flavor: "A primeira arma que todo deus recebe ao nascer." },
  { id: "lanca", name: "Lança do Sentinela", kind: "arma", element: "neutro", rarity: 1, weight: 9, price: 5, attack: 5, text: "Golpe 5.", flavor: "Montou guarda nos portões do céu por mil anos." },
  { id: "machado", name: "Machado dos Titãs", kind: "arma", element: "neutro", rarity: 2, weight: 6, price: 8, attack: 7, text: "Golpe 7.", flavor: "Pesado demais para mortais. Quase pesado demais para deuses." },
  { id: "martelo", name: "Martelo Sísmico", kind: "arma", element: "neutro", rarity: 3, weight: 2.5, price: 14, attack: 10, text: "Golpe 10.", flavor: "Quando ele cai, as montanhas mudam de lugar." },
  { id: "flechas", name: "Chuva de Flechas", kind: "arma", element: "neutro", rarity: 2, weight: 4, price: 8, attack: 3, area: true, text: "Golpe 3 em todos os outros deuses.", flavor: "Mil flechas, nenhuma com destino certo." },
  { id: "dardo", name: "Dardo da Hidra", kind: "arma", element: "neutro", rarity: 2, weight: 5, price: 6, attack: 2, inflict: { status: "veneno", turns: 3 }, text: "Golpe 2. Se ferir, envenena por 3 voltas.", flavor: "Mergulhado em cada uma das nove cabeças." },
  { id: "cetro", name: "Cetro do Sono", kind: "arma", element: "neutro", rarity: 2, weight: 4, price: 7, attack: 2, inflict: { status: "sono", turns: 1 }, text: "Golpe 2. Se ferir, o alvo dorme e perde a próxima vez.", flavor: "Um toque e até o tempo cochila." },

  // Armas elementais (só a defesa do mesmo elemento segura)
  { id: "tocha", name: "Tocha Votiva", kind: "arma", element: "fogo", rarity: 1, weight: 6, price: 5, attack: 4, text: "Golpe 4 de Fogo.", flavor: "Acesa no primeiro altar, nunca se apagou." },
  { id: "lamina", name: "Lâmina Ígnea", kind: "arma", element: "fogo", rarity: 2, weight: 4, price: 9, attack: 7, text: "Golpe 7 de Fogo.", flavor: "Forjada no coração de um vulcão adormecido." },
  { id: "fenix", name: "Fênix Rubra", kind: "arma", element: "fogo", rarity: 3, weight: 1.5, price: 18, attack: 11, text: "Golpe 11 de Fogo.", flavor: "Morre em chamas e volta mais faminta." },
  { id: "tridente", name: "Tridente das Marés", kind: "arma", element: "mar", rarity: 1, weight: 6, price: 6, attack: 5, text: "Golpe 5 de Mar.", flavor: "Cada ponta comanda uma corrente." },
  { id: "arpao", name: "Arpão do Leviatã", kind: "arma", element: "mar", rarity: 2, weight: 3, price: 10, attack: 8, text: "Golpe 8 de Mar.", flavor: "Feito do dente da criatura que ele caçava." },
  { id: "maremoto", name: "Maremoto", kind: "arma", element: "mar", rarity: 3, weight: 2, price: 13, attack: 5, area: true, text: "Golpe 5 de Mar em todos os outros deuses.", flavor: "O oceano se levanta e escolhe ninguém." },
  { id: "funda", name: "Funda dos Ventos", kind: "arma", element: "vento", rarity: 1, weight: 6, price: 5, attack: 4, text: "Golpe 4 de Vento.", flavor: "A pedra viaja mais rápido que a dúvida." },
  { id: "ciclone", name: "Ciclone", kind: "arma", element: "vento", rarity: 2, weight: 3, price: 10, attack: 8, text: "Golpe 8 de Vento.", flavor: "Começou como um suspiro de deus entediado." },
  { id: "sentenca", name: "Sentença do Tártaro", kind: "arma", element: "abismo", rarity: 3, weight: 0.7, price: 20, attack: 1, lethal: true, text: "Golpe 1 de Abismo. Se nenhuma Luz segurar, o alvo cai na hora.", flavor: "Escrita no fundo do mundo, assinada por ninguém." },
  { id: "aurora", name: "Raio da Aurora", kind: "arma", element: "luz", rarity: 3, weight: 2, price: 14, attack: 5, text: "Golpe 5 de Luz. Não pode ser defendido.", flavor: "Nada se esconde do primeiro sol." },
  { id: "foice", name: "Foice do Abismo", kind: "arma", element: "abismo", rarity: 3, weight: 2, price: 13, attack: 6, text: "Golpe 6 de Abismo. Só a Luz defende; sem defesa, dano em dobro.", flavor: "Colhe o que a luz esqueceu." },

  // Reforços (somam ao golpe de uma arma)
  { id: "furia", name: "Fúria", kind: "reforco", element: "neutro", rarity: 1, weight: 6, price: 4, boost: 3, text: "+3 no golpe de uma arma.", flavor: "Raiva divina não pede licença." },
  { id: "bencao", name: "Bênção da Força", kind: "reforco", element: "neutro", rarity: 2, weight: 3, price: 7, boost: 5, text: "+5 no golpe de uma arma.", flavor: "Um empurrão das alturas." },
  { id: "brasa", name: "Brasa Divina", kind: "reforco", element: "fogo", rarity: 2, weight: 3, price: 6, boost: 2, convert: "fogo", text: "+2 e o golpe vira Fogo.", flavor: "Uma fagulha basta." },
  { id: "rajada", name: "Rajada", kind: "reforco", element: "vento", rarity: 2, weight: 3, price: 6, boost: 2, convert: "vento", text: "+2 e o golpe vira Vento.", flavor: "O ar também tem lâminas." },

  // Defesas
  { id: "broquel", name: "Broquel de Madeira", kind: "defesa", element: "neutro", rarity: 1, weight: 7, price: 2, defense: 2, text: "Defesa 2 contra golpes neutros.", flavor: "Melhor que nada. Um pouco." },
  { id: "elmo", name: "Elmo do Guardião", kind: "defesa", element: "neutro", rarity: 1, weight: 5, price: 3, defense: 3, text: "Defesa 3 contra golpes neutros.", flavor: "Amassado em mil batalhas, nunca furado." },
  { id: "escudo", name: "Escudo de Bronze", kind: "defesa", element: "neutro", rarity: 1, weight: 5, price: 5, defense: 4, text: "Defesa 4 contra golpes neutros.", flavor: "Brilha o bastante para cegar um ciclope." },
  { id: "egide", name: "Égide Dourada", kind: "defesa", element: "neutro", rarity: 2, weight: 2, price: 10, defense: 7, text: "Defesa 7 contra golpes neutros.", flavor: "Diz a lenda que nenhuma lança a atravessou." },
  { id: "manto", name: "Manto Ígneo", kind: "defesa", element: "fogo", rarity: 1, weight: 3, price: 6, defense: 5, text: "Defesa 5 contra Fogo ou golpes neutros.", flavor: "Tecido com fios de lava fria." },
  { id: "escama", name: "Escama do Leviatã", kind: "defesa", element: "mar", rarity: 1, weight: 3, price: 6, defense: 5, text: "Defesa 5 contra Mar ou golpes neutros.", flavor: "Nem a pressão do fundo do mar a quebra." },
  { id: "veu", name: "Véu dos Ventos", kind: "defesa", element: "vento", rarity: 1, weight: 3, price: 6, defense: 5, text: "Defesa 5 contra Vento ou golpes neutros.", flavor: "O golpe passa e só encontra brisa." },
  { id: "halo", name: "Halo Sagrado", kind: "defesa", element: "luz", rarity: 2, weight: 2.5, price: 9, defense: 6, text: "Defesa 6 contra Abismo ou golpes neutros.", flavor: "Onde ele brilha, a escuridão recua." },
  { id: "espelho", name: "Espelho Celeste", kind: "defesa", element: "neutro", rarity: 3, weight: 1.5, price: 12, reflect: true, text: "Devolve o golpe inteiro para quem atacou (menos Luz).", flavor: "Mostra a cada deus o próprio rosto." },
  { id: "passo", name: "Passo Etéreo", kind: "defesa", element: "neutro", rarity: 2, weight: 2.5, price: 7, evade: 0.5, text: "Metade de chance de o golpe errar (menos Luz).", flavor: "Estava aqui. Não está mais." },

  // Milagres (gastam Fé e voltam para a mão)
  { id: "cura", name: "Cura Divina", kind: "milagre", element: "luz", rarity: 1, weight: 4, price: 8, cost: 4, target: "self", effect: { type: "cura", amount: 10 }, text: "Fé 4: recupera 10 de Vida. Fica na mão.", flavor: "As feridas se fecham como flores ao contrário." },
  { id: "purificacao", name: "Purificação", kind: "milagre", element: "luz", rarity: 1, weight: 3, price: 4, cost: 2, target: "self", effect: { type: "purificar" }, text: "Fé 2: remove todas as suas mazelas. Fica na mão.", flavor: "Água de nascente que nunca viu o sol." },
  { id: "relampago", name: "Relâmpago", kind: "milagre", element: "luz", rarity: 2, weight: 2, price: 12, cost: 6, target: "other", effect: { type: "ataque", amount: 6, element: "luz" }, text: "Fé 6: golpe 6 de Luz num deus. Fica na mão.", flavor: "O céu escolhe um alvo e não erra." },
  { id: "tempestade", name: "Tempestade", kind: "milagre", element: "vento", rarity: 2, weight: 2, price: 12, cost: 5, effect: { type: "ataque", amount: 4, element: "vento", area: true }, text: "Fé 5: golpe 4 de Vento em todos os outros. Fica na mão.", flavor: "Nuvens que obedecem a um só nome." },
  { id: "silencio", name: "Silêncio Sagrado", kind: "milagre", element: "abismo", rarity: 2, weight: 2, price: 7, cost: 3, target: "other", effect: { type: "mazela", status: "silencio", turns: 2 }, text: "Fé 3: o alvo não usa milagres por 2 voltas. Fica na mão.", flavor: "Nenhuma prece atravessa." },
  { id: "furto", name: "Furto Divino", kind: "milagre", element: "abismo", rarity: 2, weight: 2, price: 8, cost: 3, target: "other", effect: { type: "furto" }, text: "Fé 3: pega uma carta qualquer da mão do alvo. Fica na mão.", flavor: "O deus dos ladrões também tem fiéis." },
  { id: "banimento", name: "Banimento", kind: "milagre", element: "abismo", rarity: 2, weight: 2, price: 8, cost: 3, target: "other", effect: { type: "banir" }, text: "Fé 3: desfaz o guardião do alvo. Fica na mão.", flavor: "Volte para o lugar de onde veio." },
  { id: "profecia", name: "Profecia", kind: "milagre", element: "luz", rarity: 1, weight: 3, price: 5, cost: 2, target: "self", effect: { type: "profecia", amount: 2 }, text: "Fé 2: compra 2 cartas. Fica na mão.", flavor: "O futuro chega em duas partes." },

  // Milagres roubados dos deuses antigos: fortíssimos, mas custam muita Fé
  { id: "julgamento", name: "Julgamento Celeste", kind: "milagre", element: "luz", rarity: 3, weight: 0.9, price: 20, cost: 12, target: "other", effect: { type: "ataque", amount: 10, element: "luz" }, text: "Fé 12: golpe 10 de Luz num deus. Fica na mão.", flavor: "Roubado do trono do primeiro sol." },
  { id: "ira", name: "Ira dos Titãs", kind: "milagre", element: "luz", rarity: 3, weight: 0.7, price: 22, cost: 15, effect: { type: "ataque", amount: 6, element: "luz", area: true }, text: "Fé 15: golpe 6 de Luz em todos os outros. Fica na mão.", flavor: "Os titãs perderam a guerra, mas não a raiva." },
  { id: "renascer", name: "Renascer", kind: "milagre", element: "luz", rarity: 3, weight: 0.8, price: 18, cost: 14, target: "self", effect: { type: "renascer" }, text: "Fé 14: sua Vida volta a 36 e as mazelas somem. Fica na mão.", flavor: "Morrer é só um costume." },
  { id: "cetro-tempo", name: "Cetro do Tempo", kind: "milagre", element: "vento", rarity: 3, weight: 0.8, price: 18, cost: 10, target: "self", effect: { type: "turno-extra" }, text: "Fé 10: assim que esta vez acabar, você joga de novo. Fica na mão.", flavor: "Um segundo roubado do relógio do céu." },
  { id: "saque", name: "Saque dos Céus", kind: "milagre", element: "abismo", rarity: 3, weight: 0.8, price: 16, cost: 10, target: "other", effect: { type: "furto", amount: 3 }, text: "Fé 10: leva 3 cartas ao acaso da mão do alvo. Fica na mão.", flavor: "Os templos do céu nunca tiveram trancas." },

  // Céu e inferno: dádivas perigosas
  { id: "escada", name: "Escada Celeste", kind: "milagre", element: "luz", rarity: 2, weight: 1.5, price: 9, cost: 4, target: "any", effect: { type: "mazela", status: "graca", turns: 4 }, text: "Fé 4: dá Graça Celeste a um deus (até você): cura 4 por vez, mas pode levá-lo ao céu.", flavor: "Quem sobe demais não desce mais." },
  { id: "portal", name: "Portal do Tártaro", kind: "milagre", element: "abismo", rarity: 2, weight: 1.5, price: 9, cost: 5, target: "other", effect: { type: "mazela", status: "danacao", turns: 3 }, text: "Fé 5: Danação no alvo por 3 voltas: perde 3 por vez e pode ser arrastado ao Tártaro.", flavor: "A porta abre para dentro." },
  { id: "pacto", name: "Pacto Infernal", kind: "item", element: "abismo", rarity: 2, weight: 1.5, price: 7, target: "self", effect: { type: "pacto", fe: 15, status: "danacao", turns: 2 }, text: "Ganha 15 de Fé, mas recebe Danação por 2 voltas.", flavor: "As letras miúdas queimam." },

  // Itens (somem ao usar)
  { id: "ambrosia", name: "Ambrosia", kind: "item", element: "neutro", rarity: 1, weight: 4, price: 8, target: "self", effect: { type: "cura", amount: 12 }, text: "Recupera 12 de Vida.", flavor: "O banquete dos imortais, em uma colherada." },
  { id: "nectar", name: "Néctar", kind: "item", element: "neutro", rarity: 1, weight: 4, price: 5, target: "self", effect: { type: "fe", amount: 6 }, text: "Recupera 6 de Fé.", flavor: "Doce como uma oração atendida." },
  { id: "bolsa", name: "Bolsa de Oferendas", kind: "item", element: "neutro", rarity: 1, weight: 4, price: 4, target: "self", effect: { type: "ouro", amount: 12 }, text: "Ganha 12 de Ouro.", flavor: "Os mortais andaram generosos." },
  { id: "anfora", name: "Ânfora Selada", kind: "item", element: "neutro", rarity: 2, weight: 3, price: 9, target: "self", effect: { type: "invocar" }, text: "Quebre o lacre: um guardião ao acaso passa a lutar ao seu lado.", flavor: "Ninguém lembra quem foi preso aqui dentro." },
  { id: "erva", name: "Erva do Oráculo", kind: "item", element: "neutro", rarity: 1, weight: 3, price: 4, target: "self", effect: { type: "purificar", heal: 4 }, text: "Remove suas mazelas e recupera 4 de Vida.", flavor: "Mascada antes de toda profecia." },

  // Trocas
  { id: "mercado", name: "Mercado Celeste", kind: "troca", element: "neutro", rarity: 1, weight: 4, price: 3, effect: { type: "comprar" }, text: "Veja 3 relíquias à venda e compre uma com Ouro.", flavor: "Tudo tem preço. Até o divino." },
  { id: "penhor", name: "Penhorista", kind: "troca", element: "neutro", rarity: 1, weight: 3, price: 2, effect: { type: "vender" }, text: "Venda uma carta da mão pelo preço dela.", flavor: "Ele não pergunta de onde veio." },
  { id: "escambo", name: "Escambo", kind: "troca", element: "neutro", rarity: 1, weight: 3, price: 2, effect: { type: "escambo" }, text: "Ofereça uma carta a outro deus pelo Ouro que quiser. Ele aceita ou recusa.", flavor: "Entre deuses, tudo é negociável." },
  { id: "alquimia", name: "Balança da Alquimia", kind: "troca", element: "neutro", rarity: 2, weight: 3, price: 4, effect: { type: "alquimia" }, text: "Redistribua à vontade sua Vida, Fé e Ouro.", flavor: "Nada se perde, tudo se transmuta." },

  // Prodígios: raríssimos, viram a partida de uma vez
  { id: "hora-zero", name: "Hora Zero", kind: "prodigio", element: "abismo", rarity: 3, weight: 0.5, price: 25, effect: { type: "hora-zero" }, text: "A Vida de todos os deuses, inclusive a sua, vira 1.", flavor: "O relógio do céu para. Todos ficam por um fio." },
  { id: "conjuncao", name: "Grande Conjunção", kind: "prodigio", element: "luz", rarity: 3, weight: 0.9, price: 18, effect: { type: "conjuncao" }, text: "Os astros se alinham: cada deus vivo invoca um guardião ao acaso.", flavor: "Uma vez a cada mil anos, o céu abre todas as portas." },
  { id: "destinos", name: "Troca de Destinos", kind: "prodigio", element: "abismo", rarity: 3, weight: 0.9, price: 16, target: "other", effect: { type: "destinos" }, text: "Sua Vida e a do alvo trocam de lugar.", flavor: "O fio de um vira o fio do outro." },
  { id: "diluvio", name: "Dilúvio Primordial", kind: "prodigio", element: "mar", rarity: 3, weight: 0.9, price: 14, effect: { type: "diluvio" }, text: "Todos os deuses descartam a mão e compram 8 cartas novas.", flavor: "A água leva tudo, até o que você guardava." },
  { id: "lua-de-sangue", name: "Lua de Sangue", kind: "prodigio", element: "fogo", rarity: 3, weight: 0.9, price: 15, effect: { type: "fenomeno", phenomenon: "lua-de-sangue", rounds: 3 }, text: "Fenômeno: por 3 voltas, todo golpe da mesa ganha +3.", flavor: "Quando ela sobe, ninguém dorme em paz." },
];

// Os guardiões: companheiros que lutam ao lado de quem os invoca.
export const GUARDIANS: GuardianDef[] = [
  { id: "grifo", name: "Grifo Dourado", element: "vento", vida: 8, chance: 0.5, act: { type: "golpe", amount: 4, element: "vento" }, text: "Metade das vezes, golpeia um inimigo ao acaso com 4 de Vento." },
  { id: "salamandra", name: "Salamandra Rubra", element: "fogo", vida: 6, chance: 0.5, act: { type: "golpe", amount: 5, element: "fogo" }, text: "Metade das vezes, cospe 5 de Fogo num inimigo ao acaso." },
  { id: "cervo", name: "Cervo de Luz", element: "luz", vida: 8, chance: 0.6, act: { type: "cura", amount: 4 }, text: "Quase sempre, cura 4 de Vida de quem o invocou." },
  { id: "golem", name: "Golem de Bronze", element: "neutro", vida: 12, chance: 1, act: { type: "escudo" }, text: "Segura o dano dos golpes que iriam para você até se desfazer." },
  { id: "serpente", name: "Serpente das Sombras", element: "abismo", vida: 6, chance: 0.4, act: { type: "veneno", turns: 2 }, text: "Às vezes, envenena um inimigo ao acaso por 2 voltas." },
  { id: "coruja", name: "Coruja do Oráculo", element: "luz", vida: 6, chance: 0.5, act: { type: "fe", amount: 3 }, text: "Metade das vezes, traz 3 de Fé." },
  { id: "tartaruga", name: "Tartaruga das Marés", element: "mar", vida: 10, chance: 0.5, act: { type: "ouro", amount: 5 }, text: "Metade das vezes, acha 5 de Ouro no fundo do mar." },
];

export const GUARDIAN_MAP = Object.fromEntries(GUARDIANS.map((g) => [g.id, g])) as Record<GuardianId, GuardianDef>;

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function card(id: string): CardDef {
  const def = CARD_MAP[id];
  if (!def) throw new Error(`Carta desconhecida: ${id}`);
  return def;
}

export const KIND_LABEL: Record<Kind, string> = {
  arma: "Arma",
  reforco: "Reforço",
  defesa: "Defesa",
  milagre: "Milagre",
  item: "Item",
  troca: "Troca",
  prodigio: "Prodígio",
};

export const ELEMENT_LABEL: Record<Element, string> = {
  neutro: "Neutro",
  fogo: "Fogo",
  mar: "Mar",
  vento: "Vento",
  luz: "Luz",
  abismo: "Abismo",
};

export const TOTAL_WEIGHT = CARDS.reduce((sum, c) => sum + c.weight, 0);
