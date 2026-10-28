"use client";

import { BookOpen, Check, Crown, Flag, Film, Link2, LogOut, Menu, Mic, MicOff, Minus, Music, Plus, RotateCcw, Swords, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinArena } from "@/lib/api";
import { useSession } from "@/lib/session";
import { unlockAudio } from "@/lib/sfx";
import type { RoomView } from "@/game/room";
import type { GameAction, PlayerView } from "@/game/types";
import { Sigil } from "../art";

export function Victory({ view, send, busy, onLeave }: { view: RoomView; send: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; onLeave: () => void }) {
  const game = view.game!;
  if (game.phase.type !== "fim") return null;
  const winner = game.phase.winner ? game.players[game.phase.winner] : null;
  const host = view.hostId === view.you;
  const sigilOf = (id: string) => view.seats.find((s) => s.id === id)?.sigil ?? 0;
  // Ranking: quem ficou de pé, depois quem caiu por último.
  const ranking = Object.values(game.players).sort((a, b) => (a.alive === b.alive ? (b.fallen ?? 0) - (a.fallen ?? 0) : a.alive ? -1 : 1));
  const won = winner && winner.id === view.you;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-night/80 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-labelledby="fim">
      <div className="glass w-full max-w-md animate-pop rounded-3xl p-6 text-center shadow-2xl">
        {winner ? (
          <>
            <div className="relative mx-auto w-fit">
              <div className="absolute inset-0 -z-10 animate-twinkle rounded-full bg-gold/30 blur-2xl" />
              <Sigil sigil={sigilOf(winner.id)} size={88} />
              <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 text-gold-hi drop-shadow" size={34} fill="currentColor" />
            </div>
            <h2 id="fim" className="mt-5 font-display text-3xl font-extrabold">
              {won ? <span className="gold-text animate">Você reina!</span> : <span className="gold-text">{winner.name} reina</span>}
            </h2>
            <p className="mt-1 text-mute">{won ? "O Panteão inteiro se curva." : "O último deus de pé leva o trono."}</p>
          </>
        ) : (
          <h2 id="fim" className="font-display text-3xl font-extrabold">
            O Panteão ficou vazio
          </h2>
        )}

        <ol className="mt-6 space-y-1.5 text-left">
          {ranking.map((p, i) => (
            <li key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i === 0 && winner ? "bg-gold/10" : "bg-white/5"}`}>
              <span className="w-5 font-display font-bold text-gold">{i + 1}</span>
              <Sigil sigil={sigilOf(p.id)} size={28} dim={!p.alive} />
              <span className="flex-1 truncate">{p.id === view.you ? `${p.name} (você)` : p.name}</span>
              {(view.wins[p.id] ?? 0) > 0 && <span className="text-sm text-gold">★ {view.wins[p.id]}</span>}
            </li>
          ))}
        </ol>

        {view.replayId && <ReplayLink id={view.replayId} />}

        <div className="mt-4 grid gap-2">
          {view.mode === "arena" ? (
            <ArenaAgain />
          ) : host ? (
            <>
              <button type="button" disabled={busy} onClick={() => send({ op: "comecar" })} className="btn-gold flex h-12 items-center justify-center gap-2 rounded-xl font-display font-bold">
                <RotateCcw size={17} /> Revanche
              </button>
              <button type="button" disabled={busy} onClick={() => send({ op: "saguao" })} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gold/30 text-gold-hi hover:bg-gold/10">
                <Users size={16} /> Voltar ao saguão
              </button>
            </>
          ) : (
            <p className="text-sm text-mute">Esperando quem abriu a sala chamar a revanche…</p>
          )}
          <button type="button" onClick={onLeave} className="mt-1 text-sm text-faint hover:text-ink">
            Sair da sala
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplayLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const href = `/replay/${id}`;
  return (
    <div className="mt-5 flex gap-2">
      <Link href={href} target="_blank" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm text-ink hover:bg-white/5">
        <Film size={15} /> Ver o replay
      </Link>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}${href}`);
          setCopied(true);
        }}
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mute hover:text-ink"
        aria-label="Copiar o link do replay"
      >
        {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? "Copiado" : "Link"}
      </button>
    </div>
  );
}

/** Na Arena, a revanche é voltar para a fila e cair na próxima mesa. */
function ArenaAgain() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        unlockAudio();
        const { name, sigil } = useSession.getState();
        try {
          const res = await joinArena({ nome: name || "Deus sem nome", brasao: sigil });
          useSession.getState().remember(res.code!, res.token!, res.you!);
          router.push(`/sala/${res.code}`);
        } catch {
          setBusy(false);
        }
      }}
      className="btn-gold flex h-12 items-center justify-center gap-2 rounded-xl font-display font-bold"
    >
      <Swords size={17} /> Jogar de novo na Arena
    </button>
  );
}

export function AlchemyModal({ me, onClose, onConfirm, busy }: { me: PlayerView; onClose: () => void; onConfirm: (v: { vida: number; fe: number; ouro: number }) => void; busy: boolean }) {
  const pool = me.vida + me.fe + me.ouro;
  const [vida, setVida] = useState(me.vida);
  const [fe, setFe] = useState(me.fe);
  const ouro = pool - vida - fe;
  const rows = [
    { key: "vida", label: "Vida", value: vida, color: "text-vida", inc: () => ouro > 0 && setVida(vida + 1), dec: () => vida > 1 && setVida(vida - 1) },
    { key: "fe", label: "Fé", value: fe, color: "text-fe", inc: () => ouro > 0 && setFe(fe + 1), dec: () => fe > 0 && setFe(fe - 1) },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-labelledby="alq">
      <div className="glass w-full max-w-sm animate-pop rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 id="alq" className="font-display text-xl font-bold text-gold-hi">
            Balança da Alquimia
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-mute">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-mute">Total de {pool}. O que sai de um lado vai para o Ouro, e vice-versa.</p>
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <span className={`w-14 font-semibold ${r.color}`}>{r.label}</span>
              <button type="button" onClick={r.dec} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 hover:bg-white/5" aria-label={`Menos ${r.label}`}>
                <Minus size={16} />
              </button>
              <span className={`w-12 text-center font-display text-2xl font-bold tabular-nums ${r.color}`}>{r.value}</span>
              <button type="button" onClick={r.inc} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 hover:bg-white/5" aria-label={`Mais ${r.label}`}>
                <Plus size={16} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="w-14 font-semibold text-ouro">Ouro</span>
            <span className="w-[136px] text-center font-display text-2xl font-bold tabular-nums text-ouro">{ouro}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || ouro < 0}
          onClick={() => {
            onConfirm({ vida, fe, ouro });
            onClose();
          }}
          className="btn-gold mt-6 h-12 w-full rounded-xl font-display font-bold"
        >
          Transmutar
        </button>
      </div>
    </div>
  );
}

export function GameMenu({ view, play, onLeave, readOnly = false }: { view: RoomView; play: (a: GameAction) => Promise<unknown>; onLeave: () => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const music = useSession((s) => s.music);
  const narrator = useSession((s) => s.narrator);
  const me = view.you ? view.game?.players[view.you] : null;
  const canForfeit = !readOnly && !!me?.alive && view.game?.phase.type !== "fim";
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="rounded-full p-2 text-mute hover:text-ink" aria-label="Menu" aria-expanded={open}>
        <Menu size={19} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 top-11 z-50 w-56 animate-pop rounded-2xl bg-night/90 p-2 text-sm">
            <button type="button" onClick={() => useSession.getState().toggleMusic()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/5" aria-pressed={music}>
              <Music size={15} /> Trilha de batalha: {music ? "ligada" : "desligada"}
            </button>
            <button type="button" onClick={() => useSession.getState().toggleNarrator()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/5" aria-pressed={narrator}>
              {narrator ? <Mic size={15} /> : <MicOff size={15} />} Narrador: {narrator ? "ligado" : "desligado"}
            </button>
            <Link href="/codice" target="_blank" className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-white/5">
              <BookOpen size={15} /> Códice e regras
            </Link>
            {canForfeit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (window.confirm("Desistir desta partida? Você vira estrela na hora.")) void play({ type: "desistir" });
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-vida hover:bg-white/5"
              >
                <Flag size={15} /> Desistir
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (!canForfeit || window.confirm("Sair da sala? Se a partida estiver rolando, você desiste.")) onLeave();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
            >
              <LogOut size={15} /> {readOnly ? "Voltar ao início" : "Sair da sala"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
