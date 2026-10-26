import type { Metadata, Viewport } from "next";
import { Cinzel, Outfit } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://panteao.joaovaz.dev"),
  title: { default: "Panteão · duelo de deuses no navegador", template: "%s · Panteão" },
  description:
    "Um jogo de cartas por turnos para até 6 pessoas: ataque com relíquias, defenda com escudos e vire a partida com milagres. Sem cadastro, direto no navegador ou no celular.",
  applicationName: "Panteão",
};

export const viewport: Viewport = { themeColor: "#060918", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${outfit.variable} antialiased`}>
      <body className="min-h-dvh overflow-x-hidden font-sans">
        <div className="sky" aria-hidden />
        {children}
      </body>
    </html>
  );
}
