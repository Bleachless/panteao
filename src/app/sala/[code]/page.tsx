import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { RoomScreen } from "@/components/room/room-screen";

export const metadata: Metadata = { title: "Sala", robots: { index: false } };

// A sala é toda do navegador: o servidor entrega a casca e o cliente conversa com a API em tempo real.
export default function SalaPage(props: PageProps<"/sala/[code]">) {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-mute">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <RoomScreen params={props.params} />
    </Suspense>
  );
}
