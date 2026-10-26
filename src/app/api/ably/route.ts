import { connection } from "next/server";
import { fail, ok, roomCode } from "@/server/http";
import { ablyRest, channelName, realtimeKind } from "@/server/notify";

// Token do Ably só para ouvir o canal de uma sala: a chave secreta nunca vai para o navegador.
export async function GET(request: Request) {
  // A chave só existe em produção: nada de congelar esta resposta no build.
  await connection();
  try {
    if (realtimeKind() !== "ably") return Response.json({ erro: "Ably desligado." }, { status: 404 });
    const code = roomCode(new URL(request.url).searchParams.get("sala") ?? "");
    const tokenRequest = await ablyRest().auth.createTokenRequest({ capability: { [channelName(code)]: ["subscribe"] }, ttl: 60 * 60 * 1000 });
    return ok(tokenRequest);
  } catch (err) {
    return fail(err);
  }
}
