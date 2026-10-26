import { roomCode } from "@/server/http";
import { subscribe } from "@/server/notify";

// Avisos em tempo real sem serviço externo (desenvolvimento e testes): Server-Sent Events em memória.
// Em produção, com ABLY_API_KEY, os navegadores usam o Ably e esta rota fica sem uso.
export async function GET(request: Request, ctx: RouteContext<"/api/salas/[code]/eventos">) {
  const { code: raw } = await ctx.params;
  let code: string;
  try {
    code = roomCode(raw);
  } catch {
    return new Response("Sala inválida", { status: 404 });
  }
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send("retry: 2000\n\n");
      const unsubscribe = subscribe(code, (version) => send(`data: ${version}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
  });
}
