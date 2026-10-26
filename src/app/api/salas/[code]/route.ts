import { fail, ok, readJson, roomCode, tokenFrom } from "@/server/http";
import { getRoom, operate, type RoomOp } from "@/server/rooms";

// A visão da sala para quem pede (só a própria mão) e o relógio andando a cada leitura.
export async function GET(request: Request, ctx: RouteContext<"/api/salas/[code]">) {
  try {
    const { code } = await ctx.params;
    return ok(await getRoom(roomCode(code), tokenFrom(request)));
  } catch (err) {
    return fail(err);
  }
}

// Entrar, sair, mexer no saguão e jogar.
export async function POST(request: Request, ctx: RouteContext<"/api/salas/[code]">) {
  try {
    const { code } = await ctx.params;
    const body = (await readJson(request)) as unknown as RoomOp;
    return ok(await operate(roomCode(code), tokenFrom(request), body));
  } catch (err) {
    return fail(err);
  }
}
