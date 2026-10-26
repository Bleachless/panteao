import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8e2a2" />
          <stop offset="0.55" stopColor="#e8c26a" />
          <stop offset="1" stopColor="#9c7630" />
        </linearGradient>
      </defs>
      {/* frontão de templo com uma estrela no tímpano */}
      <path d="M32 6 6 22h52L32 6Z" fill="none" stroke="url(#lm-g)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="m32 11.5 1.6 4.1 4.4.2-3.4 2.8 1.2 4.2L32 20.4l-3.8 2.4 1.2-4.2-3.4-2.8 4.4-.2L32 11.5Z" fill="url(#lm-g)" />
      <path d="M12 27v22M22 27v22M32 27v22M42 27v22M52 27v22" stroke="url(#lm-g)" strokeWidth="4" strokeLinecap="round" />
      <path d="M6 55h52" stroke="url(#lm-g)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Panteão, página inicial">
      <LogoMark />
      <span className="gold-text font-display text-xl font-extrabold tracking-[0.12em]">PANTEÃO</span>
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto mt-10 max-w-6xl border-t border-white/5 px-5 py-8 text-sm text-faint">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <p>
          Feito por{" "}
          <a href="https://joaovaz.dev" className="text-mute hover:text-gold-hi">
            João Vaz
          </a>
          . Nomes, cartas e arte originais, inspirados nos jogos de cartas de deuses por turnos.
        </p>
        <a href="https://github.com/Bleachless/panteao" className="text-mute hover:text-gold-hi">
          Código no GitHub
        </a>
      </div>
    </footer>
  );
}
