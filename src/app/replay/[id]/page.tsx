import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { ReplayScreen } from "@/components/replay/replay-screen";

export const metadata: Metadata = {
  title: "Replay",
  description: "Reassista uma partida do Panteão lance por lance, do ponto de vista de qualquer deus.",
};

// O replay é reconstruído no navegador: o servidor só entrega a semente e as jogadas.
export default function ReplayPage(props: PageProps<"/replay/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-mute">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <ReplayScreen params={props.params} />
    </Suspense>
  );
}
