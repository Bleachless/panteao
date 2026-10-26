"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { MAX_SEATS } from "@/game/room";
import { useSession } from "@/lib/session";
import { useRoom } from "@/lib/use-room";
import { Sigil, SIGILS } from "../art";
import { Table } from "../game/table";
import { Logo } from "../shell";
import { Lobby } from "./lobby";

export function RoomScreen({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = use(params);
  const code = raw.toUpperCase();
  const router = useRouter();
  const { state, error, busy, send, play } = useRoom(code);

  async function leave() {
    await send({ op: "sair" });
    useSession.getState().forget(code);
    router.push("/");
  }

  if (state.status === "carregando") {
    return (
      <div className="grid h-dvh place-items-center text-mute">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (state.status === "nao-existe") {
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-bold">Essa sala sumiu no céu</h1>
          <p className="mt-2 text-mute">O código {code} não existe ou a sala já fechou.</p>
          <Link href="/" className="btn-gold mt-6 inline-flex h-11 items-center rounded-xl px-6 font-display font-bold">
            Abrir outra sala
          </Link>
        </div>
      </div>
    );
  }

  const { view } = state.data;
  if (!view.you && view.status === "saguao") {
    return view.seats.length >= MAX_SEATS ? <Message title="Sala cheia" text="Os seis tronos já estão ocupados." /> : <JoinForm code={code} send={send} busy={busy} error={error} host={view.seats.find((s) => s.id === view.hostId)?.name} />;
  }
  if (view.status === "saguao") return <Lobby view={view} send={send} busy={busy} error={error} onLeave={leave} />;
  return <Table view={view} skew={state.skew} play={play} send={send} busy={busy} error={error} onLeave={leave} />;
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-mute">{text}</p>
        <Link href="/" className="btn-gold mt-6 inline-flex h-11 items-center rounded-xl px-6 font-display font-bold">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function JoinForm({ code, send, busy, error, host }: { code: string; send: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; error: string | null; host?: string }) {
  const profile = useSession();
  const [name, setName] = useState(profile.name);
  const [sigil, setSigil] = useState(profile.sigil);
  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <Logo />
      <form
        className="glass mt-10 rounded-3xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          useSession.getState().setProfile(name.trim(), sigil);
          void send({ op: "entrar", nome: name.trim(), brasao: sigil });
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mute">Convite para a sala</p>
        <p className="gold-text mt-1 font-display text-5xl font-extrabold tracking-[0.25em]">{code}</p>
        {host && <p className="mt-2 text-sm text-mute">{host} está chamando você para a arena.</p>}
        <label htmlFor="nome-entrar" className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-mute">
          Seu nome de deus
        </label>
        <div className="mt-2 flex items-center gap-3">
          <Sigil sigil={sigil} size={46} />
          <input
            id="nome-entrar"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoFocus
            placeholder="Ex.: Vesper"
            className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-base outline-none placeholder:text-faint focus:border-gold/60"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SIGILS.map((s, i) => (
            <button key={i} type="button" aria-label={`Brasão ${s.title}`} aria-pressed={sigil === i} onClick={() => setSigil(i)} className={`rounded-full p-0.5 ${sigil === i ? "ring-2 ring-gold-hi" : "opacity-60 hover:opacity-100"}`}>
              <Sigil sigil={i} size={32} />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-vida/30 bg-vida/10 px-3 py-2 text-sm text-vida">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !name.trim()} className="btn-gold mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display font-bold">
          {busy && <Loader2 size={17} className="animate-spin" />}
          Sentar à mesa
        </button>
      </form>
    </div>
  );
}
