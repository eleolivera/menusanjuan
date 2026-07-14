"use client";

import { useState } from "react";
import { PhoneInput } from "@/components/PhoneInput";
// Pure phone-normalize module (no Prisma). `@/lib/rewards` would drag the
// Prisma client — and therefore `pg` — into the client bundle and break the
// build with "Can't resolve 'net' / 'tls'".
import { normalizePhoneE164 } from "@/lib/phone-normalize";

// Server error codes mapped to user-facing Spanish copy. Codes stay in sync
// with the register endpoint (POST /api/network/driver/register) — any code
// not in the map falls back to `network`.
const ERROR_COPY: Record<string, string> = {
  invalid_phone: "Número inválido.",
  phone_in_use:
    "Este número ya está registrado. Escribí a MenuSanJuan si es un error.",
  missing_name: "Falta el nombre.",
  invalid_resta:
    "El restaurante que escribiste no existe. Dejalo en blanco si no sabés.",
  rate_limit: "Demasiadas solicitudes. Esperá un momento y reintentá.",
  invalid_body: "Datos inválidos.",
  network: "No pudimos procesar la solicitud. Reintentá.",
};

type VehicleType = "moto" | "auto" | "bike";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "moto", label: "🛵 Moto" },
  { value: "auto", label: "🚗 Auto" },
  { value: "bike", label: "🚲 Bici" },
];

export default function RepartidorRegistrarPage() {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("moto");
  const [restaSlug, setRestaSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError(ERROR_COPY.missing_name);
      return;
    }

    // Client-side pre-flight: normalize phone locally so we don't POST junk.
    // Server re-normalizes for authority — this only saves a round-trip on
    // obviously-invalid input.
    const normalized = normalizePhoneE164(phone);
    if (!normalized) {
      setError(ERROR_COPY.invalid_phone);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/network/driver/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmedName,
          phone: normalized,
          vehicleType,
          restaSlug: restaSlug.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const key = (data?.error as string) || "network";
        setError(ERROR_COPY[key] || ERROR_COPY.network);
        return;
      }

      // Both { ok: true, driverId, pending: true } (201) and
      // { ok: true, alreadyPending: true, driverId } (200) show the same
      // "solicitud recibida" confirmation — from the driver's perspective
      // they submitted successfully either way.
      if (data?.ok) {
        setSuccess(true);
      } else {
        setError(ERROR_COPY.network);
      }
    } catch {
      setError(ERROR_COPY.network);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    displayName.trim().length > 0 && phone.length > 4 && !submitting;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 px-5 pb-10 pt-12 text-white">
      {/* Wordmark. Same "M" tile the login page uses so drivers recognise the
          same brand family when they land here from a shared link. */}
      <div className="mx-auto mb-8 flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-2xl font-extrabold text-white shadow-lg shadow-primary/25">
          M
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Registrate como Repartidor
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Completá el formulario y te enviamos el código por WhatsApp cuando
          aprobemos tu solicitud.
        </p>
      </div>

      {success ? (
        <div className="mx-auto w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-white mb-2">
            ¡Solicitud recibida!
          </h2>
          <p className="text-sm text-emerald-100/80">
            Cuando aprobemos tu registro te enviamos el código de acceso por
            WhatsApp. Usualmente respondemos el mismo día.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-sm space-y-5 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-400">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
              placeholder="Juan Pérez"
              maxLength={60}
              autoComplete="name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              required
            />
          </div>

          <PhoneInput
            darkMode
            value={phone}
            onChange={setPhone}
            label="Teléfono (WhatsApp)"
            placeholder="264 555 1234"
            required
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-400">
              Vehículo <span className="text-danger">*</span>
            </label>
            <div className="flex gap-2">
              {VEHICLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVehicleType(v.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    vehicleType === v.value
                      ? "bg-primary text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-400">
              Restaurante (opcional)
            </label>
            <input
              type="text"
              value={restaSlug}
              onChange={(e) => setRestaSlug(e.target.value)}
              placeholder="il-pilonte"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Si un restaurante te dijo su usuario, ponelo. Si no, dejalo vacío.
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
                Enviando…
              </>
            ) : (
              "Solicitar registro"
            )}
          </button>
        </form>
      )}

      <p className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-relaxed text-slate-600">
        MenuSanJuan — registro de repartidores. Recibirás el código de acceso
        por WhatsApp una vez que aprobemos tu solicitud.
      </p>
    </div>
  );
}
