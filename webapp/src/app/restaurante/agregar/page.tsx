"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Unclaimed = {
  id: string;
  name: string;
  slug: string;
  cuisineType: string;
  address: string | null;
  coverUrl: string | null;
  itemCount: number;
};

export default function AgregarRestaurantePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [unclaimed, setUnclaimed] = useState<Unclaimed[]>([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      // Require an authed user session
      const sres = await fetch("/api/restaurante/session");
      if (!sres.ok) {
        router.replace("/restaurante/login");
        return;
      }
      const res = await fetch("/api/restaurante/unclaimed");
      const data = await res.json().catch(() => []);
      setUnclaimed(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, [router]);

  const filtered = unclaimed.filter(
    (r) =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.address || "").toLowerCase().includes(search.toLowerCase()) ||
      r.cuisineType.toLowerCase().includes(search.toLowerCase())
  );

  async function handleClaim(dealerId: string) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurante/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error");
        setSubmitting(false);
        return;
      }
      router.push(`/restaurante/esperando-codigo?claimId=${data.claimId}`);
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Agregar restaurante</h1>
            <p className="text-xs text-slate-500">Reclamá uno existente o creá uno nuevo</p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Volver
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Option: create new */}
        <Link
          href="/restaurante/register?new=1"
          className="block rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-2xl">
              ➕
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-white">Crear un restaurante nuevo</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Todavía no está en MenuSanJuan. Cargá los datos y empezá desde cero.
              </p>
            </div>
            <span className="text-slate-500 self-center">→</span>
          </div>
        </Link>

        {/* Option: claim existing */}
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-2xl">
              🔎
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-white">Reclamar uno existente</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ya cargamos tu restaurante. Encontralo, pedí el reclamo, y te contactamos con un
                código para confirmar que sos el dueño.
              </p>
            </div>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, dirección, tipo de cocina..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none mb-3"
          />

          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Cargando restaurantes...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              {search ? "No encontramos nada con ese nombre" : "No hay restaurantes disponibles para reclamar"}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filtered.slice(0, 30).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/30 p-3 hover:border-primary/30 transition-colors"
                >
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center text-lg">
                    {r.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      "🍽️"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {r.cuisineType} · {r.itemCount} items {r.address ? `· ${r.address}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => handleClaim(r.id)}
                    disabled={submitting}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    Reclamar
                  </button>
                </div>
              ))}
              {filtered.length > 30 && (
                <p className="text-[10px] text-slate-600 text-center pt-2">
                  Mostrando 30 de {filtered.length}. Refiná la búsqueda.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
