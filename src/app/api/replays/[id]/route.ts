import { fail } from "@/server/http";
import { getReplay } from "@/server/rooms";

// O replay de uma partida: semente e jogadas. O navegador reconstrói tudo com o mesmo motor.
export async function GET(_request: Request, ctx: RouteContext<"/api/replays/[id]">) {
  try {
    const { id } = await ctx.params;
    const replay = await getReplay(id);
    // Replay não muda: pode ficar em cache no navegador e na borda.
    return Response.json(replay, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch (err) {
    return fail(err);
  }
}
