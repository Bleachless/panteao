"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction } from "@/game/types";
import { ApiError, fetchRoom, roomOp, type RoomResponse } from "./api";
import { useSession } from "./session";

// Mantém a sala em dia: escuta o aviso de nova versão (Ably ou SSE), busca a visão do jogador
// e agenda uma leitura quando o relógio da jogada vence (é isso que faz bots e tempos esgotados andarem).

export type RoomState =
  | { status: "carregando" }
  | { status: "nao-existe"; message: string }
  | { status: "pronto"; data: RoomResponse; skew: number };

export function useRoom(code: string) {
  const [state, setState] = useState<RoomState>({ status: "carregando" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versionRef = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const accept = useCallback((data: RoomResponse) => {
    // Respostas podem chegar fora de ordem: só vale a versão mais nova.
    if (data.version < versionRef.current) return;
    versionRef.current = data.version;
    setState({ status: "pronto", data, skew: data.now - Date.now() });
  }, []);

  const refresh = useCallback(() => {
    // Uma leitura por vez; se pedirem outra no meio, faz mais uma no fim.
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const run = async () => {
      do {
        again.current = false;
        try {
          accept(await fetchRoom(code));
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) setState({ status: "nao-existe", message: err.message });
        }
      } while (again.current);
      inFlight.current = null;
    };
    inFlight.current = run();
    return inFlight.current;
  }, [accept, code]);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const data = await roomOp(code, body);
        if (data.token && data.you) useSession.getState().remember(code, data.token, data.you);
        accept(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo deu errado.");
        void refresh();
        return null;
      } finally {
        setBusy(false);
      }
    },
    [accept, code, refresh],
  );

  const play = useCallback((acao: GameAction) => send({ op: "jogada", acao }), [send]);

  // Primeira leitura (depois que o token do aparelho foi carregado).
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useSession.persist.rehydrate()).then(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Avisos em tempo real.
  const realtime = state.status === "pronto" ? state.data.realtime : null;
  useEffect(() => {
    if (!realtime) return;
    const onVersion = (v: number) => {
      if (v > versionRef.current) void refresh();
    };
    if (realtime === "sse") {
      const source = new EventSource(`/api/salas/${code}/eventos`);
      source.onmessage = (e) => onVersion(Number(e.data));
      source.onopen = () => void refresh();
      return () => source.close();
    }
    let closed = false;
    let cleanup = () => {};
    void import("ably").then((Ably) => {
      if (closed) return;
      const client = new Ably.Realtime({ authUrl: `/api/ably?sala=${code}` });
      const channel = client.channels.get(`panteao:sala:${code}`);
      void channel.subscribe("v", (msg) => onVersion(Number(msg.data)));
      client.connection.on("connected", () => void refresh());
      cleanup = () => client.close();
    });
    return () => {
      closed = true;
      cleanup();
    };
  }, [code, realtime, refresh]);

  // Relógio: quando a decisão atual vence, uma leitura faz o servidor andar com a mesa.
  const deadline = state.status === "pronto" ? state.data.view.game?.deadline ?? null : null;
  const skew = state.status === "pronto" ? state.skew : 0;
  useEffect(() => {
    if (!deadline) return;
    const wait = Math.max(500, deadline - (Date.now() + skew) + 200);
    const id = window.setTimeout(() => void refresh(), wait);
    return () => window.clearTimeout(id);
  }, [deadline, skew, refresh, state]);

  // Rede de segurança: uma leitura de vez em quando e sempre que a aba volta a ficar visível.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8000);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { state, error, setError, busy, send, play, refresh };
}
