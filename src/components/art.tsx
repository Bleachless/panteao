import {
  Anchor,
  Axe,
  Bird,
  CloudLightning,
  Coins,
  Crown,
  Droplets,
  Eye,
  Feather,
  Flame,
  FlaskConical,
  Footprints,
  Gem,
  Hammer,
  Hand,
  HandCoins,
  HardHat,
  Heart,
  HeartPulse,
  Leaf,
  type LucideIcon,
  type LucideProps,
  Moon,
  Scale,
  Shell,
  Shield,
  ShieldCheck,
  ShieldHalf,
  Skull,
  Sparkles,
  Star,
  Store,
  Sun,
  Sunrise,
  Sword,
  Swords,
  Target,
  Tornado,
  VolumeX,
  Wand,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import type { Element } from "@/game/types";

// Arte das relíquias: ícones de traço sobre uma constelação gerada pelo id da carta.

export const ELEMENT_COLOR: Record<Element, string> = {
  neutro: "var(--color-neutro)",
  fogo: "var(--color-fogo)",
  mar: "var(--color-mar)",
  vento: "var(--color-vento)",
  luz: "var(--color-luz)",
  abismo: "var(--color-abismo)",
};

export const ELEMENT_ICON: Record<Element, LucideIcon> = {
  neutro: Swords,
  fogo: Flame,
  mar: Waves,
  vento: Wind,
  luz: Sun,
  abismo: Moon,
};

function svgIcon(paths: React.ReactNode) {
  function Custom({ size = 24, strokeWidth = 2, className, ...rest }: LucideProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...(rest as React.SVGProps<SVGSVGElement>)}
      >
        {paths}
      </svg>
    );
  }
  return Custom;
}

const Trident = svgIcon(
  <>
    <path d="M12 22V6" />
    <path d="M6 3v4a6 6 0 0 0 12 0V3" />
    <path d="M12 2v4" />
    <path d="m4.5 4.5 1.5-1.5 1.5 1.5M16.5 4.5 18 3l1.5 1.5M10.5 3.5 12 2l1.5 1.5" />
  </>,
);

const Spear = svgIcon(
  <>
    <path d="M4 20 16 8" />
    <path d="m14 4 6-2-2 6-3 1-2-2 1-3Z" />
    <path d="m6 15 3 3" />
  </>,
);

const Arrows = svgIcon(
  <>
    <path d="M6 3v13M12 2v14M18 3v13" />
    <path d="m4 14 2 3 2-3M10 13l2 3 2-3M16 14l2 3 2-3" />
    <path d="M4 21h16" />
  </>,
);

const Scythe = svgIcon(
  <>
    <path d="M8 22 15 4" />
    <path d="M15 4c-4-1-9 1-11 5 4-2 8-2 11 0" />
  </>,
);

const Mirror = svgIcon(
  <>
    <ellipse cx="12" cy="9" rx="6" ry="7" />
    <path d="M12 16v6M9 22h6" />
    <path d="m9.5 6 2-2M10 10l4-4" />
  </>,
);

const ICONS: Record<string, LucideIcon | ReturnType<typeof svgIcon>> = {
  adaga: Sword,
  lanca: Spear,
  machado: Axe,
  martelo: Hammer,
  flechas: Arrows,
  dardo: Target,
  cetro: Wand,
  tocha: Flame,
  lamina: Swords,
  fenix: Bird,
  tridente: Trident,
  arpao: Anchor,
  maremoto: Waves,
  funda: Feather,
  ciclone: Tornado,
  aurora: Sunrise,
  foice: Scythe,
  furia: Zap,
  bencao: Sparkles,
  brasa: Flame,
  rajada: Wind,
  broquel: Shield,
  elmo: HardHat,
  escudo: ShieldHalf,
  egide: ShieldCheck,
  manto: Flame,
  escama: Shell,
  veu: Wind,
  halo: Sun,
  espelho: Mirror,
  passo: Footprints,
  cura: HeartPulse,
  purificacao: Droplets,
  relampago: Zap,
  tempestade: CloudLightning,
  silencio: VolumeX,
  furto: Hand,
  profecia: Eye,
  ambrosia: Heart,
  nectar: FlaskConical,
  bolsa: Coins,
  erva: Leaf,
  mercado: Store,
  penhor: HandCoins,
  alquimia: Scale,
};

export function CardIcon({ id, ...props }: { id: string } & LucideProps) {
  const Icon = ICONS[id] ?? Gem;
  return <Icon {...props} />;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function constellation(seed: string) {
  let h = hash(seed);
  const next = () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return (h % 1000) / 1000;
  };
  const points = Array.from({ length: 7 }, () => [8 + next() * 84, 8 + next() * 84] as const);
  const lines: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    let best = 0;
    let dist = Infinity;
    for (let j = 0; j < i; j++) {
      const d = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
      if (d < dist) {
        dist = d;
        best = j;
      }
    }
    lines.push([i, best]);
  }
  return { points, lines };
}

/** Uma constelação própria para cada carta: pontos e linhas sorteados pelo id. */
export function Constellation({ seed, className }: { seed: string; className?: string }) {
  const { points, lines } = constellation(seed);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden preserveAspectRatio="none">
      {lines.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]} stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.5" />
      ))}
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill="currentColor" />
      ))}
    </svg>
  );
}

// Brasões dos deuses: símbolo e cor de cada assento.
export const SIGILS: { icon: LucideIcon; color: string; title: string }[] = [
  { icon: Sun, color: "#f7c948", title: "do Sol" },
  { icon: Moon, color: "#a3b4ff", title: "da Lua" },
  { icon: Flame, color: "#ff7a45", title: "da Chama" },
  { icon: Waves, color: "#3cc4ff", title: "das Marés" },
  { icon: Wind, color: "#62e8b6", title: "dos Ventos" },
  { icon: Star, color: "#ff8fd1", title: "das Estrelas" },
  { icon: Crown, color: "#e8c26a", title: "da Coroa" },
  { icon: Skull, color: "#b48cff", title: "do Abismo" },
];

export function Sigil({ sigil, size = 44, dim = false, className = "" }: { sigil: number; size?: number; dim?: boolean; className?: string }) {
  const s = SIGILS[sigil % SIGILS.length];
  const Icon = s.icon;
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${dim ? "opacity-40 grayscale" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${s.color}55, #0b1030 70%)`,
        boxShadow: `inset 0 0 0 1.5px ${s.color}aa, 0 0 18px -6px ${s.color}`,
        color: s.color,
      }}
    >
      <Icon size={size * 0.48} strokeWidth={1.8} />
    </span>
  );
}
