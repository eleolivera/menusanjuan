import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-20">
      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/5 to-orange-50 text-5xl">
          🍽️
        </div>
        <h1 className="text-4xl font-extrabold text-text tracking-tight mb-3">
          404
        </h1>
        <p className="text-lg text-text-secondary mb-8">
          Esta página no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
