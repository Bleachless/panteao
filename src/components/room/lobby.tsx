"use client";

import { Bot, Check, Copy, Crown, Loader2, LogOut, Play, Share2, Timer, UserPlus, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { MAX_SEATS, RITMOS, type Ritmo, type RoomView } from "@/game/room";
import { Sigil } from "../art";
import { Logo } from "../shell";

export function Lobby({ view, send, busy, error, onLeave }: { view: RoomView; send: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; error: string | null; onLeave: () => void }) {
  const host = view.hostId === view.you;
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/sala/${view.code}`;
    let alive = true;
    void QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#0b1030", light: "#f8e2a2" } }).then((data) => {
      if (!alive) return;
      setUrl(link);
      setQr(data);
    });
    return () => {
      alive = false;
    };
  }, [view.code]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: "Panteão", text: `Vem pro Panteão! Sala ${view.code}`, url }).catch(() => {});
    else await copy();
  }

  const hostSeat = view.seats.find((s) => s.id === view.hostId);
  const empty = Math.max(0, MAX_SEATS - view.seats.length);

  return (
    <main className="mx-auto max-w-5xl px-5 py-5">
      <header className="flex items-center justify-between">
        <Logo />
        <button type="button" onClick={onLeave} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-mute hover:text-ink">
          <LogOut size={15} /> Sair
        </button>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="glass rounded-3xl p-6 text-center" aria-label="Convite">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mute">Código da sala</p>
          <p className="gold-text mt-2 font-display text-6xl font-extrabold tracking-[0.25em]" data-testid="codigo">
            {view.code}
          </p>
          <div className="mx-auto mt-5 grid h-44 w-44 place-items-center overflow-hidden rounded-2xl bg-gold-hi/90 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no navegador como data URL */}
            {qr ? <img src={qr} alt={`QR Code para entrar na sala ${view.code}`} className="h-full w-full" /> : <Loader2 className="animate-spin text-night" />}
          </div>
          <p className="mt-3 text-sm text-mute">Aponte a câmera do celular ou mande o link no grupo.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gold/30 text-sm text-gold-hi hover:bg-gold/10">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado!" : "Copiar link"}
            </button>
            <button type="button" onClick={share} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gold/30 text-sm text-gold-hi hover:bg-gold/10">
              <Share2 size={16} /> Compartilhar
            </button>
          </div>
        </section>

        <section className="glass rounded-3xl p-6" aria-label="Deuses na sala">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold">Saguão</h1>
            <span className="text-sm text-mute">
              {view.seats.length}/{MAX_SEATS} deuses
            </span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="assentos">
            {view.seats.map((s) => (
              <li key={s.id} className="flex animate-rise items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
                <Sigil sigil={s.sigil} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate font-semibold">
                    {s.name}
                    {s.id === view.you && <span className="text-xs font-normal text-faint">(você)</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-mute">
                    {s.id === view.hostId && (
                      <>
                        <Crown size={11} className="text-gold" /> anfitrião
                      </>
                    )}
                    {s.bot && (
                      <>
                        <Bot size={11} /> bot
                      </>
                    )}
                    {(view.wins[s.id] ?? 0) > 0 && <span className="ml-1 text-gold">★ {view.wins[s.id]}</span>}
                  </div>
                </div>
                {host && s.id !== view.you && (
                  <button type="button" onClick={() => send({ op: "remover", assento: s.id })} className="rounded-full p-1.5 text-faint hover:bg-white/10 hover:text-vida" aria-label={`Tirar ${s.name}`}>
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
            {Array.from({ length: empty }, (_, i) => (
              <li key={`vazio-${i}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-faint">
                <span className="grid h-[38px] w-[38px] place-items-center rounded-full border border-dashed border-white/15">
                  <UserPlus size={15} />
                </span>
                Assento livre
              </li>
            ))}
          </ul>

          {host ? (
            <div className="mt-5 space-y-4">
              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-mute">
                  <Timer size={13} /> Ritmo
                </span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(RITMOS) as Ritmo[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={view.ritmo === r}
                      onClick={() => send({ op: "ritmo", ritmo: r })}
                      className={`h-10 rounded-xl border text-sm transition ${view.ritmo === r ? "border-gold/70 bg-gold/15 text-gold-hi" : "border-white/10 text-mute hover:text-ink"}`}
                    >
                      {RITMOS[r].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || empty === 0}
                  onClick={() => send({ op: "bot" })}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border border-gold/30 px-4 text-sm text-gold-hi hover:bg-gold/10 disabled:opacity-40"
                >
                  <Bot size={16} /> Adicionar bot
                </button>
                <button
                  type="button"
                  disabled={busy || view.seats.length < 2}
                  onClick={() => send({ op: "comecar" })}
                  className="btn-gold flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-display font-bold tracking-wide"
                >
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} fill="currentColor" />}
                  {view.round > 0 ? "Começar outra partida" : "Começar a partida"}
                </button>
              </div>
              {view.seats.length < 2 && <p className="text-sm text-faint">Chame alguém pelo link ou adicione um bot para começar.</p>}
            </div>
          ) : (
            <p className="mt-6 flex items-center gap-2 text-sm text-mute">
              <Loader2 size={15} className="animate-spin" /> Esperando {hostSeat?.name ?? "o anfitrião"} começar a partida…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-vida/30 bg-vida/10 px-3 py-2 text-sm text-vida">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
