"use client";

import { useState } from "react";
import { Upload, Loader2, CheckCircle2, Trash2 } from "lucide-react";

type UploadedFile = { url: string; kind: "image" | "pdf"; filename: string };

export default function NuevoReferidoPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referrer
  const [referrerName, setReferrerName] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [referrerPhone, setReferrerPhone] = useState("");
  const [referrerMpAlias, setReferrerMpAlias] = useState("");

  // Resta
  const [restaName, setRestaName] = useState("");
  const [restaAddress, setRestaAddress] = useState("");
  const [restaPhone, setRestaPhone] = useState("");
  const [restaInstagram, setRestaInstagram] = useState("");
  const [restaNotes, setRestaNotes] = useState("");

  // Menu uploads (max 6)
  const [menuFiles, setMenuFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Anti-self-referral guardrail — soft. Real check is Elio's manual review
  // at conversion time comparing referrer phone vs resta owner phone.
  const [notOwner, setNotOwner] = useState(false);

  async function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const newOnes: UploadedFile[] = [];
      for (const file of Array.from(files).slice(0, 6 - menuFiles.length)) {
        const form = new FormData();
        form.append("file", file);
        form.append("type", "lead-menu");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al subir");
        newOnes.push({
          url: data.url,
          kind: file.type === "application/pdf" ? "pdf" : "image",
          filename: file.name,
        });
      }
      setMenuFiles((prev) => [...prev, ...newOnes]);
    } catch (err) {
      setError((err as Error).message || "No pudimos subir esa foto. Probá con otra.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!referrerName.trim()) return setError("Decinos tu nombre.");
    if (!referrerPhone.trim()) return setError("Tu WhatsApp es obligatorio (lo usamos para mandarte el kit).");
    if (!restaName.trim()) return setError("Cuál es el nombre del restaurante?");
    if (menuFiles.length === 0) return setError("Subí al menos una foto del menú.");
    if (!notOwner) return setError("Confirmá que no sos el dueño del local. Si lo sos, mejor entrá a /para-restaurantes.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrerName: referrerName.trim(),
          referrerEmail: referrerEmail.trim() || undefined,
          referrerPhone: referrerPhone.trim(),
          referrerMpAlias: referrerMpAlias.trim() || undefined,
          restaName: restaName.trim(),
          restaAddress: restaAddress.trim() || undefined,
          restaPhone: restaPhone.trim() || undefined,
          restaInstagram: restaInstagram.trim() || undefined,
          restaNotes: restaNotes.trim() || undefined,
          menuFiles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Algo salió mal. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold">¡Listo, recibimos tu referido!</h1>
          <p className="text-slate-300 leading-relaxed">
            En las próximas 24-48 hs te escribimos por WhatsApp con un kit de venta personalizado
            que podés mostrarle al dueño del local.
          </p>
          <p className="text-sm text-slate-400">¿Tenés otro? <a href="/referidos/nuevo" className="text-primary underline">Cargar otro restaurante</a></p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Referí un restaurante</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Conocés un local en San Juan que podría usar MenuSanJuan? Pasanos los
            datos y te armamos un kit de venta para que se lo muestres.
          </p>
          <div className="mt-3 inline-block rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm">
            <span className="text-orange-300">Si el resta se suma y recibe su primer pedido, te pagamos </span>
            <strong className="text-white">$25.000</strong>
            <span className="text-orange-300"> por Mercado Pago.</span>
          </div>
        </header>

        {/* Referrer block */}
        <Section title="Tus datos">
          <Field label="Tu nombre *">
            <input
              type="text"
              value={referrerName}
              onChange={(e) => setReferrerName(e.target.value)}
              placeholder="Cómo te llamás"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="Tu WhatsApp *" hint="Con código de país: +54 9 264…">
            <input
              type="tel"
              value={referrerPhone}
              onChange={(e) => setReferrerPhone(e.target.value)}
              placeholder="+54 9 264 555 1234"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="Email (opcional)">
            <input
              type="email"
              value={referrerEmail}
              onChange={(e) => setReferrerEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="Alias de Mercado Pago (opcional)" hint="Para pagarte los $25.000 apenas el resta reciba su primer pedido.">
            <input
              type="text"
              value={referrerMpAlias}
              onChange={(e) => setReferrerMpAlias(e.target.value)}
              placeholder="TU.ALIAS.MP"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
        </Section>

        {/* Resta block */}
        <Section title="El restaurante">
          <Field label="Nombre del local *">
            <input
              type="text"
              value={restaName}
              onChange={(e) => setRestaName(e.target.value)}
              placeholder="El Rinconcito"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="Dirección">
            <input
              type="text"
              value={restaAddress}
              onChange={(e) => setRestaAddress(e.target.value)}
              placeholder="Av. Libertador 1234, San Juan"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="WhatsApp del local">
            <input
              type="tel"
              value={restaPhone}
              onChange={(e) => setRestaPhone(e.target.value)}
              placeholder="+54 9 264 555 1234"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="Instagram">
            <input
              type="text"
              value={restaInstagram}
              onChange={(e) => setRestaInstagram(e.target.value)}
              placeholder="@el_rinconcito"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
          <Field label="Notas para nosotros" hint="Hace delivery? Vende empanadas? Cuánto vende por noche? Lo que sepas.">
            <textarea
              value={restaNotes}
              onChange={(e) => setRestaNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Hace burgers y pizzas, abre solo a la noche, vende mucho por IG."
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2.5 text-white placeholder-slate-500"
            />
          </Field>
        </Section>

        {/* Menu uploads */}
        <Section title="Fotos del menú *">
          <p className="text-xs text-slate-400 -mt-2">
            Subí 1 a 6 fotos del menú impreso, una foto de la pizarra, o un PDF.
            Las usamos para armar el kit de venta.
          </p>

          {menuFiles.length > 0 && (
            <ul className="space-y-2">
              {menuFiles.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  {f.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.filename} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">PDF</div>
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-semibold text-emerald-300 truncate">{f.filename}</div>
                    <div className="text-slate-400">{f.kind === "pdf" ? "PDF" : "Imagen"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {menuFiles.length < 6 && (
            <label className={`block rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-6 text-center cursor-pointer hover:bg-emerald-500/10 transition-colors ${uploading ? "opacity-50" : ""}`}>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files)}
              />
              {uploading ? (
                <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo…
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto mb-1 text-emerald-300" />
                  <div className="text-sm font-semibold text-emerald-300">Subir foto del menú</div>
                  <div className="text-[10px] text-emerald-200/70 mt-1">JPG / PNG / PDF · máx 5 MB c/u · hasta 6 archivos</div>
                </>
              )}
            </label>
          )}
        </Section>

        {/* Anti-self-referral guardrail. Required client-side; admin also
            manually compares referrer phone vs resta owner phone at conversion
            time to catch any that slip through. */}
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 cursor-pointer hover:border-white/20 transition-colors">
          <input
            type="checkbox"
            checked={notOwner}
            onChange={(e) => setNotOwner(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary shrink-0"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            Confirmo que <strong className="text-white">no soy el dueño</strong> del local
            que estoy referiendo. Si sos dueño, mejor entrá a{" "}
            <a href="/para-restaurantes" className="text-primary underline">/para-restaurantes</a>.
          </span>
        </label>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || uploading}
          className="w-full rounded-xl bg-primary px-5 py-4 text-base font-bold text-white shadow-lg shadow-primary/30 hover:shadow-xl disabled:opacity-50 transition-all"
        >
          {submitting ? "Enviando…" : "Enviar referido"}
        </button>

        <p className="text-center text-[10px] text-slate-500">
          Al enviar aceptás que te contactemos por WhatsApp con el kit de venta.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-300 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
