import "server-only";
import { GameError } from "@/game/engine";
import { isRoomCode } from "@/game/room";
import { NotFound } from "./rooms";

export const TOKEN_HEADER = "x-panteao-token";

export function tokenFrom(request: Request): string | null {
  return request.headers.get(TOKEN_HEADER);
}

export function roomCode(raw: string): string {
  const code = raw.toUpperCase();
  if (!isRoomCode(code)) throw new NotFound("Código de sala inválido.");
  return code;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const noStore = { "Cache-Control": "no-store" };

export function ok(data: unknown) {
  return Response.json(data, { headers: noStore });
}

/** Erros de regra viram 400 com a mensagem para a pessoa; o resto é 500 genérico. */
export function fail(err: unknown) {
  if (err instanceof NotFound) return Response.json({ erro: err.message }, { status: 404, headers: noStore });
  if (err instanceof GameError) return Response.json({ erro: err.message }, { status: 400, headers: noStore });
  console.error(err);
  return Response.json({ erro: "Algo deu errado no Panteão. Tente de novo." }, { status: 500, headers: noStore });
}
