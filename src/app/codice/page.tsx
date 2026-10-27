import type { Metadata } from "next";
import Link from "next/link";
import { ELEMENT_COLOR, GuardianIcon } from "@/components/art";
import { CardFace } from "@/components/card-face";
import { Footer, Logo } from "@/components/shell";
import { CARDS, GUARDIANS, KIND_LABEL } from "@/game/cards";
import { DAMNATION_DAMAGE, GRACE_HEAL, HAND_SIZE, POISON_DAMAGE, START, TWILIGHT_ROUND } from "@/game/engine";
import type { Kind } from "@/game/types";

export const metadata: Metadata = {
  title: "Códice",
  description: "Todas as relíquias do Panteão: armas, reforços, defesas, milagres, itens e trocas, com as regras completas.",
};

const ORDER: { kind: Kind; blurb: string }[] = [
  { kind: "arma", blurb: "Uma por vez. Escolha o alvo; golpes em área passam por todos." },
  { kind: "reforco", blurb: "Até 2 vão junto com a arma e somam ao golpe." },
  { kind: "defesa", blurb: "Use quantas quiser quando o golpe vier. Espelho e Passo Etéreo vão sozinhos." },
  { kind: "milagre", blurb: "Gastam Fé e voltam para a mão. O Silêncio Sagrado bloqueia." },
  { kind: "item", blurb: "Usou, acabou." },
  { kind: "troca", blurb: "Mercado, Penhorista, Escambo e Alquimia: o Ouro também vence partidas." },
  { kind: "prodigio", blurb: "Raríssimos. Quando caem na mão, a partida inteira vira de uma vez." },
];

const RULES = [
  `Cada deus começa com ${START.vida} de Vida, ${START.fe} de Fé e ${START.ouro} de Ouro, e ${HAND_SIZE} cartas na mão.`,
  `No começo da sua vez, a mão é completada até ${HAND_SIZE} cartas.`,
  "Na sua vez você faz uma coisa só: atacar, usar um milagre, usar um item, negociar ou orar (compra 1 carta e passa).",
  "Quem é atacado escolhe as defesas. O dano é o golpe menos a soma das defesas que seguram aquele elemento.",
  `Mazelas: Veneno tira ${POISON_DAMAGE} de Vida no começo da vez; Sono faz perder a próxima vez; Silêncio impede milagres.`,
  `Céu e inferno: a Graça Celeste cura ${GRACE_HEAL} por vez, mas pode levar ao céu (cair na hora); a Danação tira ${DAMNATION_DAMAGE} por vez e pode arrastar ao Tártaro.`,
  "Guardiões lutam ao seu lado e agem sozinhos no começo da sua vez. Golpes em área também os ferem.",
  `A partir da ${TWILIGHT_ROUND}ª volta, o Crepúsculo tira Vida de todos no começo da vez, cada vez mais.`,
  "Quem chega a 0 de Vida vira estrela. O último deus de pé vence.",
];

export default function CodicePage() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-5">
        <Logo />
        <Link href="/" className="btn-gold rounded-full px-5 py-2 font-display text-sm font-bold">
          Jogar
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="gold-text font-display text-5xl font-extrabold tracking-wide">Códice</h1>
        <p className="mt-3 max-w-2xl text-mute">As {CARDS.length} relíquias que podem cair na sua mão. As mais raras (✦✦) aparecem bem menos.</p>

        <section className="glass mt-8 rounded-3xl p-6" aria-labelledby="regras">
          <h2 id="regras" className="font-display text-2xl font-bold text-gold-hi">
            Regras
          </h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {RULES.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink/85">
                <span className="font-display text-lg font-bold text-gold">{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
        </section>

        <nav className="mt-10 flex flex-wrap gap-2" aria-label="Tipos de carta">
          {ORDER.map(({ kind }) => (
            <a key={kind} href={`#${kind}`} className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-mute hover:border-gold/40 hover:text-gold-hi">
              {KIND_LABEL[kind]}
            </a>
          ))}
          <a href="#guardioes" className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-mute hover:border-gold/40 hover:text-gold-hi">
            Guardiões
          </a>
        </nav>

        {ORDER.map(({ kind, blurb }) => {
          const cards = CARDS.filter((c) => c.kind === kind);
          return (
            <section key={kind} id={kind} className="scroll-mt-6 pt-12">
              <h2 className="font-display text-2xl font-bold">
                {KIND_LABEL[kind]}
                <span className="ml-2 text-base font-normal text-faint">{cards.length}</span>
              </h2>
              <p className="mt-1 text-sm text-mute">{blurb}</p>
              <div className="mt-5 grid grid-cols-2 justify-items-center gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {cards.map((c) => (
                  <figure key={c.id} className="flex flex-col items-center">
                    <CardFace id={c.id} size="lg" />
                    <figcaption className="mt-2 max-w-[150px] text-center text-xs italic leading-snug text-faint">{c.flavor}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          );
        })}
        <section id="guardioes" className="scroll-mt-6 pt-12">
          <h2 className="font-display text-2xl font-bold">
            Guardiões
            <span className="ml-2 text-base font-normal text-faint">{GUARDIANS.length}</span>
          </h2>
          <p className="mt-1 text-sm text-mute">Saem da Ânfora Selada ou da Grande Conjunção. Cada deus tem um por vez; o Banimento manda embora.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GUARDIANS.map((g) => (
              <div key={g.id} className="glass flex items-center gap-4 rounded-2xl p-4">
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
                  style={{ color: ELEMENT_COLOR[g.element], background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${ELEMENT_COLOR[g.element]} 35%, transparent), #0b1030 70%)`, boxShadow: `inset 0 0 0 1.5px ${ELEMENT_COLOR[g.element]}` }}
                >
                  <GuardianIcon id={g.id} size={26} strokeWidth={1.6} />
                </span>
                <div>
                  <div className="font-display font-bold text-gold-hi">
                    {g.name} <span className="ml-1 text-sm font-normal text-vida">♥{g.vida}</span>
                  </div>
                  <p className="text-sm leading-snug text-mute">{g.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
