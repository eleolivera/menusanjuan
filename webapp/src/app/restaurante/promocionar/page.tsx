"use client";

// Owner page: pick 1–3 menu items → get a ready-to-post IG creative, a
// Spanish caption, and a step-by-step Ads Manager recipe with radius/hours/
// budget pre-computed from the resta's own data. Layer 1 = manual boost;
// Layer 2 will add "Publicar y promocionar" once Meta App Review lands.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Copy, Check, Download, ExternalLink, MapPin, Clock, Wallet, Link2 } from "lucide-react";

type MenuItemLite = { id: string; name: string; price: number; imageUrl: string | null; badge: string | null; available: boolean };
type Category = { id: string; name: string; items: MenuItemLite[] };
type Receta = {
  link: string;
  pin: { lat: number; lng: number } | null;
  radioKm: number;
  horario: { resumen: string; adsetSchedule: Array<{ days: number[]; start_minute: number; end_minute: number }> };
  presupuesto: { minimoDiarioArs: number; sugeridoDiarioArs: number; dias: number; totalArs: number };
  pasos: string[];
  adsManagerUrl: string;
};
type PromoResult = { caption: string; receta: Receta; creativeUrl: string };

function ars(n: number) { return `$ ${Math.round(n).toLocaleString("es-AR")}`; }

// Render **bold** markers from the recipe strings as <strong>.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export default function PromocionarPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [dias, setDias] = useState(5);
  const [diario, setDiario] = useState(2000);
  const [result, setResult] = useState<PromoResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState<"caption" | "link" | "pin" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/restaurante/menu")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((cats: Category[]) => { setCategories(cats); setLoading(false); })
      .catch(() => router.push("/restaurante/login"));
  }, [router]);

  const allItems = useMemo(() => categories.flatMap((c) => c.items.filter((i) => i.available)), [categories]);

  function toggle(id: string) {
    setResult(null);
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]);
  }

  async function build() {
    if (selected.length === 0) return;
    setBuilding(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ items: selected.join(","), dias: String(dias), diario: String(diario) });
      const res = await fetch(`/api/restaurante/promocionar?${qs}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No pudimos armar la promo"); return; }
      setResult(data);
    } catch {
      setError("Error de conexión");
    } finally {
      setBuilding(false);
    }
  }

  async function copy(text: string, which: "caption" | "link" | "pin") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const creativeSrc = result ? `${result.creativeUrl}&v=${selected.join("-")}` : null;

  return (
    <div className="h-full overflow-y-auto bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Promocionar en Instagram</h1>
            <p className="text-xs text-slate-500">Elegí qué vender, descargá la imagen, copiá el texto y seguí la receta en Meta.</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
        {/* Left: picker + budget */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">1. ¿Qué querés promocionar?</h2>
              <span className="text-[11px] text-slate-500">{selected.length}/3</span>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {allItems.map((it) => {
                const on = selected.includes(it.id);
                const full = !on && selected.length >= 3;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    disabled={full}
                    className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                      on ? "border-primary/60 bg-primary/10" : "border-white/5 bg-slate-950/30 hover:border-white/15"
                    } disabled:opacity-40`}
                  >
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-800 overflow-hidden">
                      {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{it.name}</div>
                      <div className="text-[11px] text-slate-500">{ars(it.price)}{it.badge ? ` · ${it.badge}` : ""}</div>
                    </div>
                    <div className={`h-5 w-5 rounded-md border flex items-center justify-center ${on ? "bg-primary border-primary" : "border-white/20"}`}>
                      {on && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
            <h2 className="text-sm font-bold text-white mb-3">2. Presupuesto</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Por día (ARS)</span>
                <input
                  type="number"
                  min={1505}
                  step={500}
                  value={diario}
                  onChange={(e) => { setResult(null); setDiario(Number(e.target.value)); }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Días</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={dias}
                  onChange={(e) => { setResult(null); setDias(Number(e.target.value)); }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Total: <span className="text-white font-semibold">{ars(diario * dias)}</span> · Mínimo de Meta ≈ $ 1.505/día</p>
          </section>

          <button
            type="button"
            onClick={build}
            disabled={selected.length === 0 || building}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-40"
          >
            {building ? "Armando…" : "Armar promo"}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Right: output */}
        <div className="space-y-6">
          {!result ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              Elegí items y tocá <span className="text-white">Armar promo</span> para ver la imagen, el texto y la receta.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white">3. Imagen para el posteo</h2>
                  <a
                    href={creativeSrc!}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar PNG
                  </a>
                </div>
                <img src={creativeSrc!} alt="Promo" className="w-full rounded-xl border border-white/5" />
                <p className="mt-2 text-[11px] text-slate-500">1080×1080 — ideal para feed. Subila desde la app de Instagram.</p>
              </section>

              <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white">4. Texto del posteo</h2>
                  <button
                    type="button"
                    onClick={() => copy(result.caption, "caption")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    {copied === "caption" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "caption" ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-950/60 border border-white/5 p-4 text-sm text-slate-200 font-sans leading-relaxed">{result.caption}</pre>
              </section>

              <section className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
                <h2 className="text-sm font-bold text-white mb-3">5. Receta para Meta Ads Manager</h2>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><MapPin className="h-3 w-3" /> Radio</div>
                    <div className="text-sm font-bold text-white mt-1">{result.receta.radioKm} km desde tu pin</div>
                    {result.receta.pin && (
                      <button
                        type="button"
                        onClick={() => copy(`${result.receta.pin!.lat.toFixed(6)}, ${result.receta.pin!.lng.toFixed(6)}`, "pin")}
                        className="mt-1 text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {copied === "pin" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {result.receta.pin.lat.toFixed(5)}, {result.receta.pin.lng.toFixed(5)}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><Clock className="h-3 w-3" /> Horario</div>
                    <div className="text-sm font-bold text-white mt-1">{result.receta.horario.resumen}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><Wallet className="h-3 w-3" /> Presupuesto total</div>
                    <div className="text-sm font-bold text-white mt-1">{ars(result.receta.presupuesto.totalArs)} · {result.receta.presupuesto.dias} días</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><Link2 className="h-3 w-3" /> Destino</div>
                    <button
                      type="button"
                      onClick={() => copy(result.receta.link, "link")}
                      className="mt-1 text-[11px] text-primary hover:underline inline-flex items-center gap-1 break-all text-left"
                    >
                      {copied === "link" ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0" />} menusanjuan.com/…?utm_source=ig
                    </button>
                  </div>
                </div>

                <ol className="space-y-2.5">
                  {result.receta.pasos.map((p, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                      <span className="shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span><Rich text={p} /></span>
                    </li>
                  ))}
                </ol>

                <a
                  href={result.receta.adsManagerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all"
                >
                  Abrir Meta Ads Manager <ExternalLink className="h-4 w-4" />
                </a>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
