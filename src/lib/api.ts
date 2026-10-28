"use client";

import type { RoomView } from "@/game/room";
import { tokenFor } from "./session";

export interface RoomResponse {
  view: RoomView;
  version: number;
  realtime: "ably" | "sse";
  now: number;
  token?: string;
  you?: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit & { code?: string } = {}): Promise<RoomResponse> {
  const token = init.code ? tokenFor(init.code) : null;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { "x-panteao-token": token } : {}), ...init.headers },
  });
  const data = await res.json().catch(() => ({ erro: "Resposta inválida do servidor." }));
  if (!res.ok) throw new ApiError(data.erro ?? "Algo deu errado.", res.status);
  return data as RoomResponse;
}

export function createRoom(body: { nome: string; brasao: number; modo: "sala" | "treino"; bots?: number }) {
  return call("/api/salas", { method: "POST", body: JSON.stringify(body) });
}

export function joinArena(body: { nome: string; brasao: number }) {
  return call("/api/arena", { method: "POST", body: JSON.stringify(body) });
}

export function fetchRoom(code: string) {
  return call(`/api/salas/${code}`, { code });
}

export function roomOp(code: string, body: Record<string, unknown>) {
  return call(`/api/salas/${code}`, { method: "POST", body: JSON.stringify(body), code });
}
