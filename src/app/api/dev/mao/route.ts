import { CARD_MAP } from "@/game/cards";
import { fail, ok, readJson, roomCode, tokenFrom } from "@/server/http";
import { hashToken } from "@/server/rooms";
import { getStore } from "@/server/store";
import { publish } from "@/server/notify";

// Rota de teste para os roteiros do Playwright: monta a mão de quem chama (e a dos bots) numa partida.
// Só existe em desenvolvimento; no build de produção ela responde 404.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Não encontrado", { status: 404 });
  try {
    const body = await readJson(request);
    const code = roomCode(String(body.sala ?? ""));
    const store = getStore();
    const current = await store.load(code);
    if (!current?.room.game) return Response.json({ erro: "Sem partida." }, { status: 400 });
    const hash = await hashToken(tokenFrom(request) ?? "");
    const seat = current.room.seats.find((s) => s.tokenHash === hash);
    if (!seat) return Response.json({ erro: "Sem assento." }, { status: 403 });
    const room = structuredClone(current.room);
    const game = room.game!;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((id): id is string => typeof id === "string" && id in CARD_MAP) : null);
    const mine = ids(body.mao);
    if (mine) game.players[seat.id].hand = mine.map((id) => ({ uid: `c${game.nextUid++}`, id }));
    if (typeof body.fe === "number") game.players[seat.id].fe = body.fe;
    if (typeof body.ouro === "number") game.players[seat.id].ouro = body.ouro;
    const bots = ids(body.bots);
    if (bots) for (const p of Object.values(game.players)) if (p.bot && p.alive) p.hand = bots.map((id) => ({ uid: `c${game.nextUid++}`, id }));
    const version = await store.save(code, room, current.version);
    if (version) await publish(code, version);
    return ok({ version });
  } catch (err) {
    return fail(err);
  }
}
