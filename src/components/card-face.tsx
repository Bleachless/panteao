import { Coins, Shield, Sparkle, Sword } from "lucide-react";
import { card, ELEMENT_LABEL, KIND_LABEL } from "@/game/cards";
import { CardIcon, Constellation, ELEMENT_COLOR } from "./art";

export type CardSize = "sm" | "md" | "lg";

const SIZE: Record<CardSize, { box: string; icon: number; name: string; badge: string }> = {
  sm: { box: "w-[74px] h-[104px] rounded-lg", icon: 26, name: "text-[9px] leading-[10px]", badge: "h-5 min-w-5 text-[11px]" },
  md: { box: "w-[104px] h-[146px] rounded-xl", icon: 36, name: "text-[11px] leading-3", badge: "h-6 min-w-6 text-sm" },
  lg: { box: "w-[150px] h-[210px] rounded-2xl", icon: 52, name: "text-sm leading-4", badge: "h-7 min-w-7 text-base" },
};

/** O valor que importa na carta: golpe, defesa, custo em Fé ou preço. */
function badgeOf(id: string) {
  const def = card(id);
  if (def.kind === "arma") return { value: def.attack, icon: Sword, tone: "#ff8a6b" };
  if (def.kind === "reforco") return { value: `+${def.boost}`, icon: Sword, tone: "#ff8a6b" };
  if (def.kind === "defesa") return def.defense ? { value: def.defense, icon: Shield, tone: "#9fd3ff" } : { value: def.reflect ? "↺" : "½", icon: Shield, tone: "#9fd3ff" };
  if (def.kind === "milagre") return { value: def.cost, icon: Sparkle, tone: "var(--color-fe)" };
  return { value: def.price, icon: Coins, tone: "var(--color-ouro)" };
}

export function CardFace({
  id,
  size = "md",
  selected = false,
  disabled = false,
  highlight = false,
  showText,
  className = "",
}: {
  id: string;
  size?: CardSize;
  selected?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  showText?: boolean;
  className?: string;
}) {
  const def = card(id);
  const color = ELEMENT_COLOR[def.element];
  const s = SIZE[size];
  const badge = badgeOf(id);
  const BadgeIcon = badge.icon;
  const text = showText ?? size === "lg";
  return (
    <div
      className={`relative isolate flex shrink-0 flex-col overflow-hidden border transition duration-200 ${s.box} ${
        selected ? "-translate-y-3 border-gold-hi" : "border-white/15"
      } ${disabled ? "opacity-45 saturate-50" : ""} ${highlight && !selected ? "animate-glow" : ""} ${className}`}
      style={{
        ["--glow" as string]: color,
        background: `radial-gradient(120% 80% at 50% 25%, color-mix(in oklab, ${color} 30%, #10163a), #0a0e26 70%)`,
        boxShadow: selected ? `0 0 0 2px var(--color-gold-hi), 0 12px 32px -8px ${color}` : undefined,
      }}
      title={`${def.name} · ${KIND_LABEL[def.kind]} de ${ELEMENT_LABEL[def.element]}: ${def.text}`}
    >
      {/* moldura dourada interna e brilho de raridade */}
      <div className="pointer-events-none absolute inset-[3px] rounded-[inherit] border border-gold/25" />
      {def.rarity === 3 && (
        <div
          className="pointer-events-none absolute inset-0 animate-shimmer opacity-40 mix-blend-screen"
          style={{ background: "linear-gradient(110deg, transparent 30%, #fff6 45%, transparent 60%)", backgroundSize: "200% 100%" }}
        />
      )}
      <Constellation seed={def.id} className="absolute inset-0 -z-10 h-full w-full opacity-60" />

      <div className="flex items-start justify-between p-1.5">
        <span
          className={`inline-flex items-center justify-center gap-0.5 rounded-full px-1 font-display font-bold text-night ${s.badge}`}
          style={{ background: badge.tone }}
        >
          {size !== "sm" && <BadgeIcon size={size === "lg" ? 14 : 11} strokeWidth={2.6} />}
          {badge.value}
        </span>
        {def.rarity > 1 && <span className="text-[10px] leading-none text-gold-hi">{"✦".repeat(def.rarity - 1)}</span>}
      </div>

      <div className="grid flex-1 place-items-center" style={{ color }}>
        <CardIcon id={def.id} size={s.icon} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
      </div>

      <div className="px-1.5 pb-1.5 text-center">
        <div className={`font-display font-bold tracking-wide text-gold-hi ${s.name}`}>{def.name}</div>
        {text && <p className="mt-1 text-[11px] leading-[13px] text-ink/80">{def.text}</p>}
        {size !== "sm" && !text && (
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em]" style={{ color }}>
            {def.element === "neutro" ? KIND_LABEL[def.kind] : ELEMENT_LABEL[def.element]}
          </div>
        )}
      </div>
    </div>
  );
}

/** O verso, para as mãos alheias e o baralho. */
export function CardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-gold/40 ${className}`}
      style={{ background: "radial-gradient(circle at 50% 40%, #2a2470, #0a0e26 75%)" }}
    >
      <div className="absolute inset-[2px] rounded-[inherit] border border-gold/20" />
      <div className="absolute inset-0 grid place-items-center text-gold/70">✦</div>
    </div>
  );
}
