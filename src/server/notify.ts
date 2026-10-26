import "server-only";
import * as Ably from "ably";

// O aviso de "a sala mudou". Ele carrega só a versão: cada navegador busca a própria visão depois,
// então nenhuma mão escondida passa pelo canal público. Com ABLY_API_KEY vai pelo Ably; sem, por SSE em memória.

type Listener = (version: number) => void;

const globalBus = globalThis as unknown as { __panteaoBus?: Map<string, Set<Listener>>; __panteaoAbly?: Ably.Rest };

function bus() {
  globalBus.__panteaoBus ??= new Map();
  return globalBus.__panteaoBus;
}

export function realtimeKind(): "ably" | "sse" {
  return process.env.ABLY_API_KEY ? "ably" : "sse";
}

export function ablyRest(): Ably.Rest {
  globalBus.__panteaoAbly ??= new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  return globalBus.__panteaoAbly;
}

export function channelName(code: string) {
  return `panteao:sala:${code}`;
}

export async function publish(code: string, version: number) {
  if (realtimeKind() === "ably") {
    try {
      await ablyRest().channels.get(channelName(code)).publish("v", version);
    } catch (err) {
      // O aviso é só um atalho: se falhar, os navegadores ainda buscam a sala pelo relógio.
      console.error("Ably: falha ao publicar", err);
    }
    return;
  }
  for (const listener of bus().get(code) ?? []) listener(version);
}

export function subscribe(code: string, listener: Listener): () => void {
  const listeners = bus().get(code) ?? new Set<Listener>();
  listeners.add(listener);
  bus().set(code, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) bus().delete(code);
  };
}
