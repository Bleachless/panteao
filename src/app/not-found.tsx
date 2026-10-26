import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid h-dvh place-items-center px-6 text-center">
      <div>
        <p className="gold-text font-display text-7xl font-extrabold">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Nenhum deus mora aqui</h1>
        <Link href="/" className="btn-gold mt-6 inline-flex h-11 items-center rounded-xl px-6 font-display font-bold">
          Voltar ao Panteão
        </Link>
      </div>
    </div>
  );
}
