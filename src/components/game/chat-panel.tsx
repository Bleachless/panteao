"use client";

import { MessageSquare, Radio, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chatOptions, parseChat, tally } from "@/game/chat";
import type { RoomView } from "@/game/room";
import { type ChatMessage, type ChatStatus, connectTwitch } from "@/lib/twitch";
import { CardIcon, ELEMENT_COLOR } from "../art";
import { card } from "@/game/cards";

/** Quanto tempo o chat tem para votar em cada decisão. */
export const VOTE_MS = 15_000;

/**
 * O painel de quem transmite: lê o chat da Twitch, abre uma votação a cada decisão do assento do chat
 * e manda o voto vencedor para o servidor quando o tempo acaba.
 */
export function ChatPanel({ view, skew, send }: { view: RoomView; skew: number; send: (b: Record<string, unknown>) => Promise<unknown> }) {
  const seat = view.seats.find((s) => s.chat)!;
  const game = view.game!;
  const phase = game.phase;
  const deciding = phase.type !== "fim" && phase.player === seat.id;
  const decision = deciding ? `${game.turn}:${phase.type}:${phase.type === "defesa" ? phase.attack.reflected : ""}` : null;
  // A visão do ponto de vista do chat, para montar as opções (a mão dele vem em `controlled`).
  const chatView = { ...game, me: view.controlled ? { id: seat.id, hand: view.controlled.hand } : null };
  const options = deciding ? chatOptions(chatView, seat.id) : [];

  const [status, setStatus] = useState<ChatStatus>("conectando");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [voteEnd, setVoteEnd] = useState<number | null>(null);
  const [test, setTest] = useState("");
  const votesRef = useRef(votes);
  const viewRef = useRef({ chatView, seat: seat.id, decision });

  // Nova decisão do chat: zera a votação.
  const [seenDecision, setSeenDecision] = useState(decision);
  if (seenDecision !== decision) {
    setSeenDecision(decision);
    setVotes({});
    setVoteEnd(null);
  }

  useEffect(() => {
    votesRef.current = votes;
    viewRef.current = { chatView, seat: seat.id, decision };
  });

  const receive = (m: ChatMessage) => {
    setMessages((list) => [...list.slice(-5), m]);
    const { chatView: v, seat: id, decision: d } = viewRef.current;
    if (!d) return;
    const key = parseChat(m.text, v, id);
    if (key) setVotes((current) => ({ ...current, [m.user]: key }));
  };
  const receiveRef = useRef(receive);
  useEffect(() => {
    receiveRef.current = receive;
  });

  useEffect(() => connectTwitch(seat.chat!, (m) => receiveRef.current(m), setStatus), [seat.chat]);

  // Fecha a votação no tempo (ou um pouco antes do relógio da partida) e manda o vencedor.
  useEffect(() => {
    if (!decision) return;
    const deadline = game.deadline ? game.deadline - skew - 1500 : Infinity;
    const end = Math.max(Date.now() + 500, Math.min(Date.now() + VOTE_MS, deadline));
    const show = window.setTimeout(() => setVoteEnd(end), 0);
    const id = window.setTimeout(() => {
      const winner = tally(votesRef.current)[0]?.key ?? null;
      void send({ op: "chat", voto: winner });
    }, end - Date.now());
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(id);
    };
  }, [decision, game.deadline, skew, send]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!decision) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [decision]);
  const left = voteEnd ? Math.max(0, Math.ceil((voteEnd - now) / 1000)) : VOTE_MS / 1000;
  const counts = tally(votes);
  const total = Object.keys(votes).length;

  return (
    <section className="glass rounded-2xl p-3 text-sm" aria-label="Chat da Twitch" data-testid="chat-panel">
      <div className="flex items-center gap-2">
        <Radio size={15} className={status === "conectado" ? "text-vida" : "text-faint"} />
        <span className="font-semibold">twitch.tv/{seat.chat}</span>
        <span className="ml-auto text-xs text-faint">{status === "conectado" ? "ao vivo" : status === "conectando" ? "conectando…" : "reconectando…"}</span>
      </div>

      {deciding ? (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-mute">
            <span>O chat decide · {total} {total === 1 ? "voto" : "votos"}</span>
            <span className="font-display text-base font-bold text-gold-hi tabular-nums">{left}s</span>
          </div>
          <ol className="mt-1.5 space-y-1">
            {options.map((o, i) => {
              const count = counts.find((c) => c.key === o.key)?.count ?? 0;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <li key={o.key} className="relative overflow-hidden rounded-lg bg-white/5 px-2 py-1">
                  <div className="absolute inset-y-0 left-0 bg-gold/20 transition-all" style={{ width: `${pct}%` }} />
                  <div className="relative flex justify-between gap-2">
                    <span className="truncate">
                      <b className="text-gold">!{i + 1}</b> {o.label}
                    </span>
                    <span className="tabular-nums text-mute">{count}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="mt-2 text-xs text-mute">Quando for a vez do {seat.name}, o chat vota aqui.</p>
      )}

      {view.controlled && (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Mão do chat">
          {view.controlled.hand.map((c) => {
            const def = card(c.id);
            return (
              <span key={c.uid} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-px text-[10px]" style={{ color: ELEMENT_COLOR[def.element] }}>
                <CardIcon id={c.id} size={10} /> {def.name}
              </span>
            );
          })}
        </div>
      )}

      <ul className="mt-2 max-h-24 space-y-0.5 overflow-hidden text-xs text-mute">
        {messages.map((m, i) => (
          <li key={i} className="truncate">
            <b className="text-ink/80">{m.user}</b>: {m.text}
          </li>
        ))}
      </ul>

      <form
        className="mt-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!test.trim()) return;
          receive({ user: `teste${Object.keys(votes).length + 1}`, text: test.trim() });
          setTest("");
        }}
      >
        <MessageSquare size={14} className="mt-2 shrink-0 text-faint" />
        <input
          value={test}
          onChange={(e) => setTest(e.target.value)}
          placeholder="Testar como o chat: !orar"
          aria-label="Testar um comando do chat"
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 text-xs outline-none focus:border-gold/50"
        />
        <button type="submit" aria-label="Enviar comando de teste" className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-mute hover:text-ink">
          <Send size={13} />
        </button>
      </form>
    </section>
  );
}
