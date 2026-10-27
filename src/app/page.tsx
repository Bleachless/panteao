import { Bird, BookOpen, Coins, Flame, Hourglass, Orbit, Shield, Sparkles, Sword } from "lucide-react";
import Link from "next/link";
import { ELEMENT_COLOR, ELEMENT_ICON } from "@/components/art";
import { CardFace } from "@/components/card-face";
import { StartPanel } from "@/components/home/start-panel";
import { Footer, Logo } from "@/components/shell";
import { CARDS, ELEMENT_LABEL } from "@/game/cards";
import { START } from "@/game/engine";
import type { Element } from "@/game/types";

const FAN = ["foice", "lamina", "espelho", "tridente", "relampago"];

const STEPS = [
  { icon: Sword, title: "Ataque", text: "Na sua vez, escolha uma arma e um alvo. Até 2 reforços somam ao golpe e podem trocar o elemento." },
  { icon: Shield, title: "Defenda", text: "Quando o golpe vem em você, junte quantas defesas quiser. O dano é o golpe menos a defesa." },
  { icon: Sparkles, title: "Milagres", text: "Gastam Fé e voltam para a mão: cura, raios, silêncio e até furto de cartas." },
  { icon: Coins, title: "Trocas", text: "Compre no Mercado Celeste, venda o que sobra, faça escambo com os outros deuses e pese Vida, Fé e Ouro na Alquimia." },
];

const SHOWCASE = ["hora-zero", "conjuncao", "destinos", "sentenca", "julgamento", "lua-de-sangue", "cetro-tempo"];

const TWISTS = [
  { icon: Bird, color: "var(--color-vento)", title: "Guardiões", text: "Quebre uma Ânfora Selada e um grifo, um golem ou uma serpente passa a lutar ao seu lado, agindo sozinho a cada vez sua." },
  { icon: Flame, color: "var(--color-fogo)", title: "Céu e inferno", text: "A Graça Celeste cura toda vez, mas pode levar você ao céu de vez. A Danação queima e pode arrastar ao Tártaro." },
  { icon: Orbit, color: "var(--color-luz)", title: "Prodígios", text: "Hora Zero deixa todo mundo com 1 de Vida. A Grande Conjunção dá um guardião a cada deus. A Troca de Destinos troca a sua Vida com a de outro." },
];

const ELEMENTS: { el: Element; rule: string }[] = [
  { el: "neutro", rule: "Qualquer defesa segura." },
  { el: "fogo", rule: "Só defesa de Fogo segura." },
  { el: "mar", rule: "Só defesa de Mar segura." },
  { el: "vento", rule: "Só defesa de Vento segura." },
  { el: "abismo", rule: "Só a Luz segura. Sem defesa, dano em dobro." },
  { el: "luz", rule: "Ninguém segura." },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-5">
        <Logo />
        <Link href="/codice" className="flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 text-sm text-gold-hi transition hover:bg-gold/10">
          <BookOpen size={16} /> Códice
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold/80">Duelo de deuses · 2 a 6 jogadores · no navegador</p>
            <h1 className="gold-text animate mt-3 pt-2 font-display text-6xl leading-[1.15] font-extrabold tracking-[0.06em] sm:text-7xl lg:text-8xl">PANTEÃO</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/85">
              Cada deus começa com <b className="text-vida">{START.vida} de Vida</b>, <b className="text-fe">{START.fe} de Fé</b> e <b className="text-ouro">{START.ouro} de Ouro</b>. Ataque com relíquias, defenda com o elemento certo e vire a partida com milagres. O último de pé reina.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm text-mute">
              {["Sem cadastro", "Link para o grupo", "Joga no celular", "Bots para treinar", "Tempo real"].map((t) => (
                <li key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {t}
                </li>
              ))}
            </ul>

            <div className="relative mt-12 hidden h-56 sm:block" aria-hidden>
              {FAN.map((id, i) => (
                <div
                  key={id}
                  className="absolute bottom-0 left-1/2 origin-bottom transition duration-500 hover:-translate-y-4"
                  style={{ transform: `translateX(calc(-50% + ${(i - 2) * 80}px)) rotate(${(i - 2) * 8}deg) translateY(${Math.abs(i - 2) * 10}px)` }}
                >
                  <CardFace id={id} size="lg" showText={false} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <StartPanel />
          </div>
        </section>

        <section className="py-12" aria-labelledby="como">
          <h2 id="como" className="font-display text-3xl font-bold text-gold-hi">
            Como se joga
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.title} className="glass rounded-2xl p-5">
                <s.icon className="text-gold" size={26} strokeWidth={1.6} />
                <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12" aria-labelledby="viradas">
          <h2 id="viradas" className="font-display text-3xl font-bold text-gold-hi">
            Cartas que viram tudo
          </h2>
          <p className="mt-2 max-w-2xl text-mute">Raríssimas, caras ou perigosas. Quando uma delas cai na mesa, ninguém está seguro.</p>
          <div className="scrollbar-none -mx-5 mt-6 flex gap-4 overflow-x-auto px-5 pb-2">
            {SHOWCASE.map((id) => (
              <CardFace key={id} id={id} size="lg" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TWISTS.map((t) => (
              <div key={t.title} className="glass rounded-2xl p-5">
                <t.icon size={24} strokeWidth={1.6} style={{ color: t.color }} />
                <h3 className="mt-3 font-display text-lg font-bold">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">{t.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-12 lg:grid-cols-[1fr_1fr]" aria-labelledby="elementos">
          <div>
            <h2 id="elementos" className="font-display text-3xl font-bold text-gold-hi">
              Os seis elementos
            </h2>
            <p className="mt-2 text-mute">Escudo comum não segura fogo. Guarde uma defesa de cada elemento e um Halo para o Abismo.</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {ELEMENTS.map(({ el, rule }) => {
                const Icon = ELEMENT_ICON[el];
                return (
                  <li key={el} className="glass flex items-center gap-3 rounded-xl px-4 py-3">
                    <Icon size={22} style={{ color: ELEMENT_COLOR[el] }} />
                    <div>
                      <div className="font-display font-bold" style={{ color: ELEMENT_COLOR[el] }}>
                        {ELEMENT_LABEL[el]}
                      </div>
                      <div className="text-sm text-mute">{rule}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="glass relative overflow-hidden rounded-3xl p-6">
            <Hourglass className="text-abismo" size={30} strokeWidth={1.5} />
            <h3 className="mt-3 font-display text-2xl font-bold">O Crepúsculo</h3>
            <p className="mt-2 leading-relaxed text-mute">
              Deuses também cansam. A partir da 8ª volta da mesa, o Crepúsculo tira Vida de todos no começo de cada vez: 1, depois 2, depois 3… Ninguém fica se escondendo atrás do escudo para sempre.
            </p>
            <p className="mt-4 leading-relaxed text-mute">
              Ficou sem arma? <b className="text-ink">Ore</b>: você compra uma carta e passa a vez. Toda vez começa com a mão completa em 8 cartas.
            </p>
            <Link href="/codice" className="mt-6 inline-flex items-center gap-2 text-gold-hi underline-offset-4 hover:underline">
              <BookOpen size={16} /> Ver todas as {CARDS.length} relíquias e os guardiões no Códice
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
