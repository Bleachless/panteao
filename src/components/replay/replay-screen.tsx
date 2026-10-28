"use client";

import { ChevronLeft, ChevronRight, Eye, Loader2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { viewFor } from "@/game/engine";
import { replayStates, type Replay, type RoomView } from "@/game/room";
import { useSession } from "@/lib/session";
import { Table } from "../game/table";

const SPEEDS = [1, 2, 4];

export function ReplayScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void useSession.persist.rehydrate();
    let alive = true;
    fetch(`/api/replays/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!alive) return;
        if (res.ok) setReplay(data as Replay);
        else setError(data.erro ?? "Replay não encontrado.");
      })
      .catch(() => alive && setError("Não consegui baixar o replay."));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-bold">Esse replay sumiu no céu</h1>
          <p className="mt-2 text-mute">{error}</p>
          <Link href="/" className="btn-gold mt-6 inline-flex h-11 items-center rounded-xl px-6 font-display font-bold">
            Jogar uma partida
          </Link>
        </div>
      </div>
    );
  }
  if (!replay) {
    return (
      <div className="grid h-dvh place-items-center text-mute">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  return <ReplayPlayer replay={replay} />;
}

function ReplayPlayer({ replay }: { replay: Replay }) {
  const router = useRouter();
  const states = useMemo(() => replayStates(replay), [replay]);
  const last = states.length - 1;
  const final = states[last];
  const winner = final.phase.type === "fim" ? final.phase.winner : null;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [eye, setEye] = useState<string>(winner ?? replay.players[0].id);

  // Avança sozinho; para no fim.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, last)), 1300 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, last]);
  const atEnd = step >= last;

  const view: RoomView = {
    code: "REPLAY",
    mode: "sala",
    status: "jogo",
    hostId: "",
    seats: replay.players.map((p) => ({ id: p.id, name: p.name, bot: p.bot, sigil: replay.sigils[p.id] ?? 0 })),
    ritmo: "livre",
    round: 1,
    wins: {},
    game: { ...viewFor(states[step], eye), deadline: null },
    you: eye,
    startsAt: null,
    replayId: null,
    controlled: null,
  };

  const button = "grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-ink hover:bg-white/5 disabled:opacity-30";
  const controls = (
    <section className="glass mx-2 mb-2 rounded-2xl px-3 py-2 sm:mx-3" aria-label="Controles do replay">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} onClick={() => setStep(0)} disabled={step === 0} aria-label="Voltar ao começo">
          <SkipBack size={16} />
        </button>
        <button type="button" className={button} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} aria-label="Lance anterior">
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn-gold grid h-10 w-12 place-items-center rounded-xl"
          onClick={() => {
            if (atEnd) setStep(0);
            setPlaying(!playing || atEnd);
          }}
          aria-label={playing && !atEnd ? "Pausar" : "Tocar"}
        >
          {playing && !atEnd ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
        </button>
        <button type="button" className={button} onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={atEnd} aria-label="Próximo lance">
          <ChevronRight size={18} />
        </button>
        <button type="button" className={button} onClick={() => setStep(last)} disabled={atEnd} aria-label="Ir para o fim">
          <SkipForward size={16} />
        </button>
        <button type="button" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} className="h-10 rounded-xl border border-white/10 px-3 font-display text-sm font-bold text-gold-hi" aria-label="Mudar a velocidade">
          {speed}×
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={step}
          onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }}
          aria-label="Posição no replay"
          className="min-w-32 flex-1 accent-[var(--color-gold)]"
        />
        <span className="text-xs tabular-nums text-mute">
          {step}/{last}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-mute">
          <Eye size={14} />
          <select value={eye} onChange={(e) => setEye(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-night px-2 text-ink" aria-label="De quem ver a mão">
            {replay.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {atEnd && (
        <p className="mt-2 text-center font-display text-sm font-bold text-gold-hi">
          {winner ? `${final.players[winner].name} reinou sobre o Panteão.` : "Ninguém restou."}{" "}
          <Link href="/" className="text-ink underline-offset-4 hover:underline">
            Jogar uma partida
          </Link>
        </p>
      )}
    </section>
  );

  return <Table view={view} skew={0} play={async () => null} send={async () => null} busy={false} error={null} onLeave={() => router.push("/")} readOnly footer={controls} />;
}
