"use client";

import { Coins, Heart, Hourglass, Loader2, ScrollText, Sparkle, Wind, X } from "lucide-react";
import { useMemo, useState } from "react";
import { card, ELEMENT_LABEL } from "@/game/cards";
import { blocks, damageFor, MAX_BOOSTERS, twilightDamage } from "@/game/engine";
import type { RoomView } from "@/game/room";
import type { CardDef, CardInst, GameAction, GameView, PlayerView } from "@/game/types";
import { CardIcon, ELEMENT_COLOR, ELEMENT_ICON, Sigil } from "../art";
import { CardFace } from "../card-face";
import { AlchemyModal, GameMenu, Victory } from "./overlays";
import { Floats, LogList, OpponentChip, StatusChips, TimerRing, useCountdown } from "./parts";

type Send = (body: Record<string, unknown>) => Promise<unknown>;
type Play = (action: GameAction) => Promise<unknown>;

export function Table({ view, skew, play, send, busy, error, onLeave }: { view: RoomView; skew: number; play: Play; send: Send; busy: boolean; error: string | null; onLeave: () => void }) {
  const game = view.game!;
  // Abre uma "janela" no log: o que já tinha acontecido antes de abrir a tela não anima de novo.
  const [since] = useState(() => game.log[game.log.length - 1]?.seq ?? 0);
  const [logOpen, setLogOpen] = useState(false);
  const phase = game.phase;
  // A seleção reinicia sozinha a cada nova decisão (a key muda).
  const decisionKey = `${game.turn}:${phase.type}:${phase.type === "fim" ? "" : phase.player}:${phase.type === "defesa" ? phase.attack.reflected : ""}`;

  return (
    <main className="mx-auto flex h-dvh max-w-7xl flex-col">
      <TopBar view={view} onLog={() => setLogOpen(true)} play={play} onLeave={onLeave} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Board key={decisionKey} view={view} game={game} since={since} skew={skew} play={play} busy={busy} error={error} />
        </div>
        <aside className="glass m-3 ml-0 hidden w-72 flex-col rounded-2xl p-4 lg:flex">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">
            <ScrollText size={15} /> Crônica
          </h2>
          <LogList log={game.log} className="mt-2 min-h-0 flex-1" />
        </aside>
      </div>
      {logOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 lg:hidden" onClick={() => setLogOpen(false)}>
          <div className="glass max-h-[70dvh] w-full rounded-t-3xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">Crônica</h2>
              <button type="button" onClick={() => setLogOpen(false)} aria-label="Fechar crônica" className="p-1 text-mute">
                <X size={18} />
              </button>
            </div>
            <LogList log={game.log} className="mt-2 max-h-[58dvh]" />
          </div>
        </div>
      )}
      {phase.type === "fim" && <Victory view={view} send={send} busy={busy} onLeave={onLeave} />}
    </main>
  );
}

function TopBar({ view, onLog, play, onLeave }: { view: RoomView; onLog: () => void; play: Play; onLeave: () => void }) {
  const game = view.game!;
  const twilight = twilightDamage(game.round);
  return (
    <header className="flex items-center gap-3 px-3 pt-3 sm:px-4">
      <span className="gold-text font-display text-lg font-extrabold tracking-[0.12em]">PANTEÃO</span>
      <span className="rounded-md border border-white/10 px-2 py-0.5 font-display text-xs tracking-[0.2em] text-mute">{view.code}</span>
      <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${twilight ? "bg-abismo/20 text-abismo" : "text-mute"}`}>
        <Hourglass size={13} />
        Volta {game.round}
        {twilight > 0 && <b className="font-semibold">· Crepúsculo −{twilight}</b>}
      </span>
      <button type="button" onClick={onLog} className="rounded-full p-2 text-mute hover:text-ink lg:hidden" aria-label="Abrir crônica">
        <ScrollText size={18} />
      </button>
      <GameMenu view={view} play={play} onLeave={onLeave} />
    </header>
  );
}

type Hand = { inst: CardInst; def: CardDef }[];

function Board({ view, game, since, skew, play, busy, error }: { view: RoomView; game: GameView; since: number; skew: number; play: Play; busy: boolean; error: string | null }) {
  const you = view.you;
  const me = you ? game.players[you] : null;
  const phase = game.phase;
  const decider = phase.type === "fim" ? null : phase.player;
  const myTurn = !!me?.alive && decider === you;
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [alchemy, setAlchemy] = useState<string | null>(null);

  const hand: Hand = useMemo(() => (game.me?.hand ?? []).map((inst) => ({ inst, def: card(inst.id) })), [game.me]);
  const byUid = (uid: string) => hand.find((h) => h.inst.uid === uid);
  const picked = selected.map(byUid).filter(Boolean) as Hand;
  const opponents = game.order.filter((id) => id !== you).map((id) => game.players[id]);
  const alive = opponents.filter((p) => p.alive);
  const seconds = useCountdown(decider && !game.players[decider]?.bot ? game.deadline : null, skew);
  const total = phase.type === "defesa" ? game.settings.defenseSeconds ?? 0 : game.settings.actionSeconds ?? 0;

  // ---------- O que a seleção atual permite ----------
  const weapon = picked.find((h) => h.def.kind === "arma");
  const boosters = picked.filter((h) => h.def.kind === "reforco");
  const main = picked.find((h) => h.def.kind !== "arma" && h.def.kind !== "reforco");
  const broker = picked.find((h) => h.def.effect?.type === "vender");
  const sellItem = broker ? picked.find((h) => h.inst.uid !== broker.inst.uid) : undefined;
  const needsTarget = !!((weapon && !weapon.def.area) || (main && main.def.target === "other" && !broker));
  const effectiveTarget = needsTarget ? (target ?? (alive.length === 1 ? alive[0].id : null)) : null;
  const silenced = !!me?.statuses.some((s) => s.id === "silencio");

  function toggle(h: Hand[number]) {
    const uid = h.inst.uid;
    if (selected.includes(uid)) return setSelected(selected.filter((u) => u !== uid));
    if (phase.type === "defesa") {
      const special = h.def.reflect || h.def.evade;
      const rest = selected.filter((u) => {
        const d = byUid(u)?.def;
        return d && !d.reflect && !d.evade && !special;
      });
      return setSelected([...rest, uid]);
    }
    if (broker && h.inst.uid !== broker.inst.uid) return setSelected([broker.inst.uid, uid]);
    if (h.def.kind === "arma") return setSelected([uid, ...boosters.map((b) => b.inst.uid)]);
    // Cabem dois reforços: o terceiro empurra o mais antigo para fora.
    if (h.def.kind === "reforco") return setSelected([...(weapon ? [weapon.inst.uid] : []), ...boosters.map((b) => b.inst.uid).slice(-(MAX_BOOSTERS - 1)), uid]);
    setSelected([uid]);
  }

  function playable(h: Hand[number]): boolean {
    if (!myTurn) return false;
    if (phase.type === "defesa") return blocks(h.def, phase.attack.element);
    if (phase.type !== "acao") return false;
    if (broker && h.inst.uid !== broker.inst.uid) return true;
    return h.def.kind !== "defesa";
  }

  async function act(action: GameAction) {
    await play(action);
  }

  // ---------- Barra de ações ----------
  let primary: { label: string; action?: GameAction; onClick?: () => void; disabled?: boolean; reason?: string } | null = null;
  let hint = "";
  if (myTurn && phase.type === "acao") {
    if (weapon) {
      const power = (weapon.def.attack ?? 0) + boosters.reduce((s, b) => s + (b.def.boost ?? 0), 0);
      const t = effectiveTarget ? game.players[effectiveTarget] : null;
      primary = weapon.def.area
        ? { label: `Atacar todos · ${power}`, action: { type: "atacar", weapon: weapon.inst.uid, boosters: boosters.map((b) => b.inst.uid), target: "" } }
        : {
            label: t ? `Atacar ${t.name} · ${power}` : `Escolha o alvo · ${power}`,
            action: t ? { type: "atacar", weapon: weapon.inst.uid, boosters: boosters.map((b) => b.inst.uid), target: t.id } : undefined,
            disabled: !t,
          };
      hint = boosters.length ? "Reforços somados ao golpe." : "Junte até 2 reforços, se tiver, e toque num deus para mirar.";
    } else if (broker) {
      primary = sellItem
        ? { label: `Vender ${sellItem.def.name} · +${sellItem.def.price}`, action: { type: "vender", card: broker.inst.uid, item: sellItem.inst.uid } }
        : { label: "Escolha a carta para vender", disabled: true };
    } else if (main) {
      const fx = main.def.effect;
      const cost = main.def.cost ?? 0;
      const blocked = main.def.kind === "milagre" && (silenced ? "Você está sob Silêncio." : (me?.fe ?? 0) < cost ? `Precisa de ${cost} de Fé.` : "");
      if (fx?.type === "alquimia") primary = { label: "Pesar na Balança", onClick: () => setAlchemy(main.inst.uid) };
      else if (fx?.type === "comprar") primary = { label: "Abrir o Mercado", action: { type: "usar", card: main.inst.uid } };
      else if (main.def.target === "other") {
        const t = effectiveTarget ? game.players[effectiveTarget] : null;
        primary = { label: t ? `Usar em ${t.name}` : "Escolha o alvo", action: t ? { type: "usar", card: main.inst.uid, target: t.id } : undefined, disabled: !t || !!blocked, reason: blocked || undefined };
      } else if (fx?.type === "ataque" && fx.area) primary = { label: `Invocar sobre todos · ${fx.amount}`, action: { type: "usar", card: main.inst.uid }, disabled: !!blocked, reason: blocked || undefined };
      else if (main.def.kind === "defesa") primary = { label: "Defesas só quando atacarem você", disabled: true };
      else primary = { label: `Usar ${main.def.name}`, action: { type: "usar", card: main.inst.uid }, disabled: !!blocked, reason: blocked || undefined };
      hint = main.def.text;
    } else hint = "Escolha uma carta da mão, ou ore para comprar uma e passar a vez.";
  }

  let defenseInfo: { total: number; damage: number; label: string } | null = null;
  if (myTurn && phase.type === "defesa") {
    const attack = phase.attack;
    const special = picked.find((h) => h.def.reflect || h.def.evade);
    const sum = picked.reduce((s, h) => s + (h.def.defense ?? 0), 0);
    const damage = damageFor(attack, sum);
    defenseInfo = { total: sum, damage, label: special ? (special.def.reflect ? "Devolver o golpe" : "Tentar esquivar (50%)") : picked.length ? `Defender · sofre ${damage}` : `Receber o golpe · ${damage}` };
  }

  return (
    <>
      {/* Oponentes */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-3 pb-2 pt-4 sm:flex-wrap sm:justify-center sm:px-4">
        {opponents.map((p) => (
          <OpponentChip
            key={p.id}
            player={p}
            seat={view.seats.find((s) => s.id === p.id)}
            game={game}
            since={since}
            wins={view.wins[p.id] ?? 0}
            isHost={view.hostId === p.id}
            targetable={needsTarget && p.alive && myTurn}
            targeted={effectiveTarget === p.id}
            onTarget={() => setTarget(p.id)}
          />
        ))}
      </div>

      {/* Arena */}
      <section className="scrollbar-none flex min-h-0 flex-1 flex-col items-center justify-center-safe overflow-y-auto px-3 py-2 text-center" aria-live="polite">
        <Arena view={view} game={game} me={me} seconds={seconds} total={total} play={act} busy={busy} />
      </section>

      {/* Eu */}
      {me && game.me ? (
        <section className="glass safe-bottom relative mx-2 mb-2 rounded-3xl px-3 pt-3 sm:mx-3 sm:px-4" aria-label="Sua mão">
          <Floats log={game.log} target={me.id} since={since} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Sigil sigil={view.seats.find((s) => s.id === me.id)?.sigil ?? 0} size={34} dim={!me.alive} />
            <span className="font-semibold">{me.name}</span>
            <Stat icon={Heart} value={me.vida} color="text-vida" label="Vida" />
            <Stat icon={Sparkle} value={me.fe} color="text-fe" label="Fé" />
            <Stat icon={Coins} value={me.ouro} color="text-ouro" label="Ouro" />
            <StatusChips player={me} />
            {myTurn && seconds !== null && (
              <span className="ml-auto">
                <TimerRing seconds={seconds} total={total} size={36} />
              </span>
            )}
          </div>

          <div className="scrollbar-none -mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 pt-4 sm:-mx-4 sm:px-4">
            {hand.map((h) => {
              const can = playable(h);
              return (
                <button
                  key={h.inst.uid}
                  type="button"

                  onClick={() => can && toggle(h)}
                  aria-pressed={selected.includes(h.inst.uid)}
                  aria-label={`${h.def.name}: ${h.def.text}`}
                  data-card={h.def.id}
                  className="shrink-0 animate-rise focus-visible:outline-none"
                >
                  <CardFace id={h.def.id} size="md" className="max-sm:h-[118px] max-sm:w-[84px]" selected={selected.includes(h.inst.uid)} disabled={myTurn && !can} highlight={myTurn && phase.type === "defesa" && can} />
                </button>
              );
            })}
            {hand.length === 0 && <p className="py-8 text-sm text-faint">{me.alive ? "Mão vazia." : "Você virou estrela. Assista ao fim da partida."}</p>}
          </div>

          {error && (
            <p role="alert" className="mt-2 rounded-xl border border-vida/30 bg-vida/10 px-3 py-1.5 text-sm text-vida">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 pb-1">
            {myTurn && phase.type === "acao" && (
              <>
                {primary && (
                  <button
                    type="button"
                    disabled={busy || primary.disabled}
                    onClick={() => (primary.onClick ? primary.onClick() : primary.action && act(primary.action))}
                    className="btn-gold flex h-11 min-w-0 flex-1 items-center justify-center gap-2 truncate rounded-xl px-4 font-display text-sm font-bold sm:flex-none"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" />}
                    {primary.label}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ type: "orar" })}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-gold/40 px-4 font-display text-sm font-bold text-gold-hi hover:bg-gold/10 ${primary ? "" : "flex-1 sm:flex-none"}`}
                >
                  <Wind size={15} /> Orar
                </button>
                <p className="w-full text-xs text-mute sm:w-auto sm:flex-1">{primary?.reason ?? hint}</p>
              </>
            )}
            {myTurn && phase.type === "defesa" && defenseInfo && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ type: "defender", cards: selected })}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-display text-sm font-bold sm:flex-none ${selected.length ? "btn-gold" : "border border-vida/60 text-vida hover:bg-vida/10"}`}
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {defenseInfo.label}
                </button>
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])} className="h-11 rounded-xl px-3 text-sm text-mute hover:text-ink">
                    Limpar
                  </button>
                )}
                <p className="w-full text-xs text-mute sm:w-auto sm:flex-1">
                  {hand.some((h) => blocks(h.def, phase.attack.element))
                    ? `Toque nas defesas que seguram ${ELEMENT_LABEL[phase.attack.element]}.`
                    : phase.attack.element === "luz"
                      ? "Golpe de Luz: nada segura."
                      : `Nenhuma carta sua segura ${ELEMENT_LABEL[phase.attack.element]}.`}
                </p>
              </>
            )}
            {!myTurn && me.alive && phase.type !== "fim" && <p className="py-2 text-sm text-mute">Você pode olhar suas cartas enquanto espera.</p>}
          </div>
        </section>
      ) : (
        <p className="glass safe-bottom mx-3 mb-3 rounded-2xl px-4 pt-3 text-center text-sm text-mute">Você está assistindo esta partida.</p>
      )}

      {alchemy && me && <AlchemyModal me={me} onClose={() => setAlchemy(null)} onConfirm={(v) => act({ type: "alquimia", card: alchemy, ...v })} busy={busy} />}
    </>
  );
}

function CardChip({ id }: { id: string }) {
  const def = card(id);
  const color = ELEMENT_COLOR[def.element];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] font-semibold" style={{ color, borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, background: `color-mix(in oklab, ${color} 10%, transparent)` }}>
      <CardIcon id={id} size={11} /> {def.name}
    </span>
  );
}

function Stat({ icon: Icon, value, color, label }: { icon: typeof Heart; value: number; color: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-display text-lg font-bold tabular-nums ${color}`} title={label} aria-label={`${label}: ${value}`}>
      <Icon size={15} fill={label === "Vida" ? "currentColor" : "none"} />
      {value}
    </span>
  );
}

function Arena({ view, game, me, seconds, total, play, busy }: { view: RoomView; game: GameView; me: PlayerView | null; seconds: number | null; total: number; play: (a: GameAction) => Promise<void>; busy: boolean }) {
  const phase = game.phase;
  const sigilOf = (id: string) => view.seats.find((s) => s.id === id)?.sigil ?? 0;
  // O que acabou de acontecer: as últimas linhas da crônica, com as cartas usadas.
  const recent = game.log.filter((l) => l.kind !== "turno" && l.kind !== "info").slice(-4);

  if (phase.type === "fim") return null;

  if (phase.type === "defesa") {
    const attack = phase.attack;
    const from = game.players[attack.from];
    const to = game.players[phase.player];
    const Icon = ELEMENT_ICON[attack.element];
    const color = ELEMENT_COLOR[attack.element];
    const mine = phase.player === me?.id;
    return (
      <div key={`${attack.reflected}-${phase.player}`} className="animate-pop">
        <div className="flex items-center justify-center gap-3 text-sm text-mute">
          <span className="inline-flex items-center gap-2">
            <Sigil sigil={sigilOf(from.id)} size={24} /> {from.name}
          </span>
          <span className="text-lg" style={{ color }}>
            ⟶
          </span>
          <span className={`inline-flex items-center gap-2 ${mine ? "font-semibold text-vida" : ""}`}>
            <Sigil sigil={sigilOf(to.id)} size={24} /> {mine ? "Você" : to.name}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 sm:mt-3 sm:flex-col sm:gap-3">
          <div className="flex items-end justify-center gap-1.5 sm:gap-2">
            {attack.cards.map((c, i) => (
              <div key={c.uid} className="animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
                <CardFace id={c.id} size="sm" className="sm:hidden" />
                <CardFace id={c.id} size="md" className={`max-sm:hidden ${i === 0 ? "sm:h-[180px] sm:w-[128px]" : ""}`} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 font-display text-4xl font-extrabold max-sm:flex-col max-sm:gap-0" style={{ color, textShadow: `0 0 24px ${color}` }}>
            <span className="flex items-center gap-2">
              <Icon size={30} />
              {attack.power}
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] sm:text-base">{ELEMENT_LABEL[attack.element]}</span>
          </div>
        </div>
        {attack.reflected > 0 && <p className="mt-1 text-sm text-gold-hi">Refletido pelo Espelho Celeste!</p>}
        <p className="mt-1 text-sm text-mute">{mine ? "Defenda-se!" : `${to.name} escolhe a defesa…`}</p>
        {!mine && seconds !== null && (
          <div className="mt-2 flex justify-center">
            <TimerRing seconds={seconds} total={total} size={34} />
          </div>
        )}
      </div>
    );
  }

  if (phase.type === "mercado") {
    const mine = phase.player === me?.id;
    if (!mine || !phase.offer) return <p className="text-mute">{game.players[phase.player].name} examina as relíquias do Mercado Celeste…</p>;
    return (
      <div className="animate-pop">
        <h2 className="font-display text-xl font-bold text-gold-hi">Mercado Celeste</h2>
        <p className="text-sm text-mute">Você tem {me!.ouro} de Ouro. Escolha uma relíquia ou saia.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {phase.offer.map((c) => {
            const def = card(c.id);
            const can = def.price <= me!.ouro;
            return (
              <div key={c.uid} className="flex flex-col items-center gap-2">
                <CardFace id={c.id} size="lg" disabled={!can} />
                <button type="button" disabled={!can || busy} onClick={() => play({ type: "comprar", offer: c.uid })} className="btn-gold inline-flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold">
                  <Coins size={14} /> {def.price}
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" disabled={busy} onClick={() => play({ type: "comprar", offer: null })} className="mt-4 text-sm text-mute underline-offset-4 hover:text-ink hover:underline">
          Sair sem comprar
        </button>
      </div>
    );
  }

  const active = game.players[phase.player];
  const mine = phase.player === me?.id;
  return (
    <div key={phase.player} className="animate-pop">
      <Sigil sigil={sigilOf(active.id)} size={mine ? 64 : 56} className="mx-auto max-sm:hidden" />
      <h2 className="font-display text-2xl font-bold sm:mt-3 sm:text-3xl">{mine ? <span className="gold-text">Sua vez</span> : `Vez de ${active.name}`}</h2>
      {!mine && (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-mute">
          {active.bot ? (
            <>
              <Loader2 size={14} className="animate-spin" /> pensando…
            </>
          ) : seconds !== null ? (
            <TimerRing seconds={seconds} total={total} size={34} />
          ) : (
            "decidindo…"
          )}
        </div>
      )}
      {recent.length > 0 && (
        <ul className="mx-auto mt-3 max-w-lg space-y-1.5 text-left text-[13px] sm:mt-5" aria-label="Últimas jogadas">
          {recent.map((l, i) => (
            <li key={l.seq} className={`flex flex-wrap items-center gap-1.5 ${i === recent.length - 1 ? "text-ink" : "text-ink/55"} ${i < recent.length - 2 ? "max-sm:hidden" : ""}`}>
              <span>{l.text}</span>
              {l.cards?.map((id, j) => <CardChip key={`${id}-${j}`} id={id} />)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
