"use client";

import { Bot, Coins, Crown, Droplet, Flame, Heart, Moon, Skull, Sparkle, Sun, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { START, STATUS_LABEL } from "@/game/engine";
import type { SeatView } from "@/game/room";
import type { GameView, LogEntry, PlayerView, StatusId } from "@/game/types";
import { GUARDIAN_MAP } from "@/game/cards";
import { ELEMENT_COLOR, GuardianIcon, Sigil } from "../art";
import { CardBack } from "../card-face";

export const STATUS_ICON: Record<StatusId, typeof Droplet> = { veneno: Droplet, sono: Moon, silencio: VolumeX, graca: Sun, danacao: Flame };
const STATUS_COLOR: Record<StatusId, string> = { veneno: "#7be36b", sono: "#a3b4ff", silencio: "#c49bff", graca: "#ffe27a", danacao: "#ff5a3c" };

/** O guardião de um deus: ícone, nome e Vida que sobra. */
export function GuardianBadge({ player, compact = false }: { player: PlayerView; compact?: boolean }) {
  const g = player.guardian;
  if (!g) return null;
  const def = GUARDIAN_MAP[g.id];
  const color = ELEMENT_COLOR[def.element];
  return (
    <span
      key={g.id}
      title={`${def.name} (${g.vida} de Vida): ${def.text}`}
      data-guardian={g.id}
      className="inline-flex animate-pop items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold"
      style={{ color, borderColor: `color-mix(in oklab, ${color} 50%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      <GuardianIcon id={g.id} size={11} />
      {!compact && <span className="max-w-36 truncate">{def.name}</span>}
      <span className="tabular-nums text-ink/80">♥{g.vida}</span>
    </span>
  );
}

export function StatusChips({ player }: { player: PlayerView }) {
  if (player.statuses.length === 0) return null;
  return (
    <div className="flex gap-1">
      {player.statuses.map((st) => {
        const Icon = STATUS_ICON[st.id];
        return (
          <span
            key={st.id}
            title={`${STATUS_LABEL[st.id]} (${st.turns} ${st.turns === 1 ? "volta" : "voltas"})`}
            className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-semibold"
            style={{ color: STATUS_COLOR[st.id], borderColor: `${STATUS_COLOR[st.id]}55`, background: `${STATUS_COLOR[st.id]}14` }}
          >
            <Icon size={10} />
            {st.turns}
          </span>
        );
      })}
    </div>
  );
}

/** Números que sobem e somem quando alguém leva dano ou se cura. Só mostra o que aconteceu depois de abrir a tela. */
export function Floats({ log, target, since }: { log: LogEntry[]; target: string; since: number }) {
  const recent = log.filter((l) => l.seq > since && l.target === target && (l.kind === "dano" || l.kind === "crepusculo" || l.kind === "cura")).slice(-3);
  const heals = log.filter((l) => l.seq > since && l.actor === target && l.kind === "cura" && !l.target).slice(-2);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0" aria-hidden>
      {[...recent, ...heals].map((l) => (
        <span
          key={l.seq}
          className="absolute left-1/2 top-0 animate-float-up whitespace-nowrap font-display text-2xl font-extrabold"
          style={{
            color: l.kind === "cura" ? "#7dffb0" : l.element ? ELEMENT_COLOR[l.element] : "#ff5c7a",
            textShadow: "0 2px 12px #000, 0 0 2px #000",
          }}
        >
          {l.kind === "cura" ? "+" : "−"}
          {l.amount}
        </span>
      ))}
    </div>
  );
}

function lastHitSeq(log: LogEntry[], target: string, since: number) {
  for (let i = log.length - 1; i >= 0; i--) {
    const l = log[i];
    if (l.seq <= since) return 0;
    if (l.target === target && (l.kind === "dano" || l.kind === "crepusculo")) return l.seq;
  }
  return 0;
}

export function OpponentChip({
  player,
  seat,
  game,
  since,
  wins,
  isHost,
  targetable,
  targeted,
  onTarget,
}: {
  player: PlayerView;
  seat?: SeatView;
  game: GameView;
  since: number;
  wins: number;
  isHost: boolean;
  targetable: boolean;
  targeted: boolean;
  onTarget: () => void;
}) {
  const phase = game.phase;
  const active = game.active === player.id && phase.type !== "fim";
  const defending = phase.type === "defesa" && phase.player === player.id;
  const hit = lastHitSeq(game.log, player.id, since);
  const ring = defending ? "ring-2 ring-vida/80" : active ? "ring-2 ring-gold/80" : "";
  const vidaPct = Math.max(0, Math.min(100, (player.vida / START.vida) * 100));
  return (
    <button
      type="button"
      onClick={onTarget}
      disabled={!targetable}
      aria-pressed={targeted}
      aria-label={`${player.name}: ${player.vida} de Vida${targetable ? ". Tocar para mirar" : ""}`}
      data-player={player.id}
      className={`glass relative w-[142px] shrink-0 rounded-2xl p-2 text-left transition sm:w-[176px] sm:p-2.5 ${ring} ${
        targetable ? "cursor-crosshair hover:bg-white/10" : "cursor-default"
      } ${targeted ? "bg-vida/15 ring-2 ring-vida" : ""} ${!player.alive ? "opacity-50" : ""}`}
    >
      <Floats log={game.log} target={player.id} since={since} />
      <div key={hit} className={hit ? "animate-shake" : ""}>
        <div className="flex items-center gap-2">
          <span className="relative">
            <Sigil sigil={seat?.sigil ?? 0} size={32} dim={!player.alive} />
            {!player.alive && <Skull className="absolute -bottom-1 -right-1 rounded-full bg-night p-0.5 text-mute" size={16} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1 truncate text-sm font-semibold">
              {isHost && <Crown size={12} className="shrink-0 text-gold" aria-label="Anfitrião" />}
              {player.bot && <Bot size={12} className="shrink-0 text-mute" aria-label="Bot" />}
              <span className="truncate">{player.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-mute">
              <span className="inline-flex items-center gap-0.5 text-fe">
                <Sparkle size={10} />
                {player.fe}
              </span>
              <span className="inline-flex items-center gap-0.5 text-ouro">
                <Coins size={10} />
                {player.ouro}
              </span>
              <span className="inline-flex items-center gap-1">
                <CardBack className="h-3 w-2" />
                {player.handCount}
              </span>
              {wins > 0 && <span className="text-gold">★{wins}</span>}
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 sm:mt-2">
          <Heart size={12} className="shrink-0 text-vida" fill="currentColor" />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-vida to-[#ff9a8a] transition-all duration-700" style={{ width: `${vidaPct}%` }} />
          </div>
          <span className="w-6 text-right font-display text-sm font-bold tabular-nums">{player.vida}</span>
        </div>
        {(player.statuses.length > 0 || player.guardian) && (
          <div className="mt-1 flex flex-wrap gap-1">
            <GuardianBadge player={player} compact />
            <StatusChips player={player} />
          </div>
        )}
      </div>
      {defending && <span className="absolute -top-2 right-2 rounded-full bg-vida px-2 text-[10px] font-bold uppercase tracking-wider text-night">defendendo</span>}
      {active && !defending && <span className="absolute -top-2 right-2 rounded-full bg-gold px-2 text-[10px] font-bold uppercase tracking-wider text-night">na vez</span>}
    </button>
  );
}

/** Contagem regressiva da decisão atual, acertada pelo relógio do servidor. */
export function useCountdown(deadline: number | null, skew: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + skew)) / 1000));
}

export function TimerRing({ seconds, total, size = 40 }: { seconds: number; total: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? seconds / total : 0;
  const urgent = seconds <= 5;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`${seconds} segundos`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff1a" strokeWidth="3" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={urgent ? "var(--color-vida)" : "var(--color-gold)"}
          strokeWidth="3"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className={`absolute font-display text-sm font-bold tabular-nums ${urgent ? "text-vida" : "text-gold-hi"}`}>{seconds}</span>
    </span>
  );
}

const LOG_COLOR: Partial<Record<LogEntry["kind"], string>> = {
  ataque: "#ff9a7a",
  dano: "#ff5c7a",
  defesa: "#9fd3ff",
  cura: "#7dffb0",
  milagre: "#79a8ff",
  troca: "#f2c14e",
  mazela: "#c49bff",
  queda: "#9aa0c3",
  vitoria: "#f8e2a2",
  crepusculo: "#a874ff",
  turno: "#5d6390",
};

export function LogList({ log, className = "" }: { log: LogEntry[]; className?: string }) {
  const end = useRef<HTMLDivElement>(null);
  const last = log[log.length - 1]?.seq;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [last]);
  return (
    <div className={`overflow-y-auto pr-1 text-[13px] leading-snug ${className}`} aria-live="polite">
      {log.map((l) =>
        l.kind === "turno" ? (
          <div key={l.seq} className="mt-2 border-t border-white/5 pt-2 text-[11px] uppercase tracking-[0.16em] text-faint">
            {l.text}
          </div>
        ) : (
          <p key={l.seq} className="mt-1 flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LOG_COLOR[l.kind] ?? "#9aa0c3" }} />
            <span className={l.kind === "vitoria" ? "font-display font-bold text-gold-hi" : "text-ink/85"}>{l.text}</span>
          </p>
        ),
      )}
      <div ref={end} />
    </div>
  );
}
