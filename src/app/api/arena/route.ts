import { cleanName } from "@/game/room";
import { fail, ok, readJson } from "@/server/http";
import { joinArena } from "@/server/rooms";

// Jogar agora: entra numa mesa pública da Arena (ou abre uma) e recebe o token do assento.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const sigil = Math.max(0, Math.trunc(Number(body.brasao) || 0));
    return ok(await joinArena({ name: cleanName(body.nome), sigil }));
  } catch (err) {
    return fail(err);
  }
}
