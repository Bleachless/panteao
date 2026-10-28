"use client";

import { Bot, DoorOpen, Loader2, Plus, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isRoomCode } from "@/game/room";
import { createRoom, joinArena } from "@/lib/api";
import { unlockAudio } from "@/lib/sfx";
import { useSession } from "@/lib/session";
import { Sigil, SIGILS } from "../art";

type Tab = "arena" | "criar" | "treinar" | "entrar";

export function StartPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("arena");
  const [name, setName] = useState("");
  const [sigil, setSigil] = useState(0);
  const [bots, setBots] = useState(3);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve(useSession.persist.rehydrate()).then(() => {
      const s = useSession.getState();
      if (s.name) setName(s.name);
      setSigil(s.sigil);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // O clique destrava o áudio do navegador: a abertura da partida já pode tocar.
    unlockAudio();
    const nome = name.trim();
    if (tab === "entrar") {
      const c = code.trim().toUpperCase();
      if (!isRoomCode(c)) return setError("O código tem 4 letras, como QXBT.");
      if (nome) useSession.getState().setProfile(nome, sigil);
      router.push(`/sala/${c}`);
      return;
    }
    if (!nome) return setError("Dê um nome ao seu deus.");
    setBusy(true);
    try {
      useSession.getState().setProfile(nome, sigil);
      const res = tab === "arena" ? await joinArena({ nome, brasao: sigil }) : await createRoom({ nome, brasao: sigil, modo: tab === "treinar" ? "treino" : "sala", bots });
      useSession.getState().remember(res.code!, res.token!, res.you!);
      router.push(`/sala/${res.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Plus }[] = [
    { id: "arena", label: "Arena", icon: Swords },
    { id: "criar", label: "Criar", icon: Plus },
    { id: "treinar", label: "Treinar", icon: Bot },
    { id: "entrar", label: "Entrar", icon: DoorOpen },
  ];

  return (
    <form onSubmit={submit} className="glass w-full max-w-md rounded-3xl p-5 shadow-2xl shadow-black/40 sm:p-6" aria-label="Começar a jogar">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/30 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium transition max-[380px]:gap-1 max-[380px]:text-xs ${
              tab === t.id ? "bg-gold/15 text-gold-hi shadow-inner shadow-gold/10" : "text-mute hover:text-ink"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.18em] text-mute" htmlFor="nome">
        Seu nome de deus
      </label>
      <div className="mt-2 flex items-center gap-3">
        <Sigil sigil={sigil} size={46} />
        <input
          id="nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="Ex.: Kora, a Implacável"
          autoComplete="nickname"
          className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-base text-ink outline-none placeholder:text-faint focus:border-gold/60"
        />
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-mute">Brasão</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIGILS.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Brasão ${s.title}`}
              aria-pressed={sigil === i}
              onClick={() => setSigil(i)}
              className={`rounded-full p-0.5 transition ${sigil === i ? "ring-2 ring-gold-hi" : "opacity-60 hover:opacity-100"}`}
            >
              <Sigil sigil={i} size={34} />
            </button>
          ))}
        </div>
      </fieldset>

      {tab === "treinar" && (
        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-mute">Bots na mesa</span>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={bots === n}
                onClick={() => setBots(n)}
                className={`h-10 rounded-xl border font-display text-lg transition ${bots === n ? "border-gold/70 bg-gold/15 text-gold-hi" : "border-white/10 text-mute hover:text-ink"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "entrar" && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-mute" htmlFor="codigo">
            Código da sala
          </label>
          <input
            id="codigo"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            placeholder="QXBT"
            autoCapitalize="characters"
            className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-black/30 text-center font-display text-3xl tracking-[0.5em] text-gold-hi outline-none placeholder:text-faint/50 focus:border-gold/60"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-vida/30 bg-vida/10 px-3 py-2 text-sm text-vida">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-gold mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-base font-bold tracking-wider">
        {busy && <Loader2 className="animate-spin" size={18} />}
        {tab === "arena" ? "Jogar agora" : tab === "criar" ? "Abrir a sala" : tab === "treinar" ? "Descer à arena" : "Entrar na sala"}
      </button>
      <p className="mt-3 text-center text-xs text-faint">
        {tab === "arena"
          ? "Mesa pública com quem estiver online. Em 20 segundos, bots completam as vagas."
          : tab === "criar"
          ? "Você recebe um link para mandar no grupo. Até 6 deuses por mesa."
          : tab === "treinar"
            ? "Uma partida na hora contra bots, sem relógio."
            : "Peça o código para quem abriu a sala."}
      </p>
    </form>
  );
}
