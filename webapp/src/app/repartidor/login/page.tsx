"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/PhoneInput";
// Import from the pure phone-normalize module (no Prisma) rather than
// `@/lib/rewards`, which pulls the Prisma client — and therefore `pg` — into
// the client bundle and breaks the build ("Can't resolve 'net' / 'tls'").
import { normalizePhoneE164 } from "@/lib/phone-normalize";

// Error copy mapped from server error codes. The server returns
// { error: "invalid_credentials" | "invalid_phone" | "invalid_body" }.
// Anything else surfaces the generic connection message.
const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Código o teléfono inválido. Verificá con el restaurante.",
  invalid_phone: "Ese número no parece válido. Revisá el código de país.",
  invalid_body: "Faltan datos.",
  network: "No pudimos conectarnos. Reintentá.",
};

export default function RepartidorLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Code input: uppercase, 6 chars, [A-Z0-9]. Strip anything else on paste.
  function handleCodeChange(next: string) {
    const cleaned = next
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setCode(cleaned);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side pre-flight: normalize phone locally so we don't POST junk.
    // Server re-normalizes for authority — this only saves a round-trip on
    // obviously-invalid input.
    const normalized = normalizePhoneE164(phone);
    if (!normalized) {
      setError(ERROR_COPY.invalid_phone);
      return;
    }
    if (code.length !== 6) {
      setError(ERROR_COPY.invalid_body);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/network/driver/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const key = (data?.error as string) || "network";
        setError(ERROR_COPY[key] || ERROR_COPY.network);
        return;
      }

      // Session cookie is set by the server via Set-Cookie. Push to /repartidor
      // (server component) which will call requireDriverSession() and render
      // the shift dashboard, or bounce us back here if the cookie didn't take.
      router.push("/repartidor");
      router.refresh();
    } catch {
      setError(ERROR_COPY.network);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = phone.length > 4 && code.length === 6 && !submitting;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 px-5 pb-10 pt-12 text-white">
      {/* Wordmark. Mirrors the "M" motif from other login surfaces (owner /
          admin) so drivers recognize it as the same brand family — but on a
          dark background because the PWA lives there. */}
      <div className="mx-auto mb-8 flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-2xl font-extrabold text-white shadow-lg shadow-primary/25">
          M
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          MenuSanJuan Repartidor
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Ingresá con tu teléfono y el código que te compartió el restaurante.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-sm space-y-5 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur"
      >
        <PhoneInput
          darkMode
          value={phone}
          onChange={setPhone}
          label="Teléfono"
          placeholder="264 555 1234"
          required
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-400">
            Código de acceso <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="one-time-code"
            spellCheck={false}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="ABC123"
            maxLength={6}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-2xl uppercase tracking-[0.4em] text-white placeholder:text-slate-600 placeholder:tracking-[0.4em] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            6 caracteres, letras y números.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Ingresando…
            </>
          ) : (
            "Ingresar"
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          ¿No tenés código? Pedile uno al restaurante que te contrató.
        </p>
      </form>

      <p className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-relaxed text-slate-600">
        MenuSanJuan — panel privado de repartidores. Los códigos son de un solo
        uso y vencen al iniciar sesión.
      </p>
    </div>
  );
}
