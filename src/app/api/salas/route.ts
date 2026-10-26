import { cleanName, MAX_SEATS } from "@/game/room";
import { fail, ok, readJson } from "@/server/http";
import { createNewRoom } from "@/server/rooms";

// Cria uma sala (ou um treino contra bots, que já começa jogando).
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const mode = body.modo === "treino" ? "treino" : "sala";
    const bots = Math.min(MAX_SEATS - 1, Math.max(1, Math.trunc(Number(body.bots) || 1)));
    const sigil = Math.max(0, Math.trunc(Number(body.brasao) || 0));
    return ok(await createNewRoom({ name: cleanName(body.nome), mode, bots, sigil }));
  } catch (err) {
    return fail(err);
  }
}
