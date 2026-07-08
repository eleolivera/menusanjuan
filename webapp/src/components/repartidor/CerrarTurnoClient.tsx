"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  shift: {
    id: string;
    startedAt: string;
    cashOnHandStart: number;
  };
  collectedTotal: number;
  expectedCash: number;
  blocked: boolean;
  blockedOrderNumber?: string;
  blockedOrderId?: string;
};

function formatARS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("es-AR")}`;
}

function elapsedSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

type CloseResult = {
  cashOnHandStart: number;
  cashOnHandEnd: number;
  expectedCash: number;
  discrepancy: number;
};

export function CerrarTurnoClient({
  shift,
  collectedTotal,
  expectedCash,
  blocked,
  blockedOrderNumber,
  blockedOrderId,
}: Props) {
  const router = useRouter();
  const [input, setInput] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const entered = useMemo(() => {
    const n = parseInt(input.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }, [input]);

  const liveDiscrepancy = entered - expectedCash;
  const canSubmit = !blocked && input.trim() !== "" && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/network/driver/shift/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashOnHandEnd: entered }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "order_in_flight") {
          setError("Tenés un pedido activo. Terminalo antes de cerrar turno.");
        } else if (data?.error === "no_active_shift") {
          setError("No hay turno abierto.");
        } else {
          setError("No se pudo cerrar el turno");
        }
        setSubmitting(false);
        return;
      }
      setResult({
        cashOnHandStart: data.shift.cashOnHandStart,
        cashOnHandEnd: data.shift.cashOnHandEnd,
        expectedCash: data.shift.expectedCash,
        discrepancy: data.shift.discrepancy,
      });
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/network/driver/session", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    router.push("/repartidor/login");
  }

  // Result screen after successful close
  if (result) {
    const d = result.discrepancy;
    const label = d === 0 ? "Todo cuadra" : d > 0 ? "Te sobra" : "Te falta";
    const boxCls =
      d === 0
        ? "bg-emerald-500/10 border-emerald-500/40"
        : d > 0
        ? "bg-amber-500/10 border-amber-500/40"
        : "bg-red-500/10 border-red-500/40";
    const smallCls =
      d === 0 ? "text-emerald-300/80" : d > 0 ? "text-amber-300/80" : "text-red-300/80";
    const bigCls =
      d === 0 ? "text-emerald-400" : d > 0 ? "text-amber-400" : "text-red-400";
    const captionCls =
      d === 0 ? "text-emerald-300/70" : d > 0 ? "text-amber-300/70" : "text-red-300/70";

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          <div className="text-center pt-4">
            <div className="text-4xl mb-2">✅</div>
            <h1 className="text-xl font-bold">Turno cerrado</h1>
          </div>

          <div className={`rounded-2xl border-2 p-5 text-center ${boxCls}`}>
            <div className={`text-[11px] uppercase tracking-wider ${smallCls}`}>Diferencia</div>
            <div className={`text-3xl font-extrabold mt-1 ${bigCls}`}>{formatARS(d)}</div>
            <div className={`text-xs mt-1 ${captionCls}`}>{label}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Efectivo al iniciar</span>
              <span className="text-slate-200">{formatARS(result.cashOnHandStart)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Efectivo esperado</span>
              <span className="text-slate-200">{formatARS(result.expectedCash)}</span>
            </div>
            <div className="flex justify-between text-slate-400 border-t border-white/5 pt-2">
              <span>Efectivo en mano</span>
              <span className="text-slate-200 font-semibold">{formatARS(result.cashOnHandEnd)}</span>
            </div>
          </div>

          <Link
            href="/repartidor"
            className="block w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-center text-base font-bold text-white shadow-lg shadow-orange-500/20"
          >
            Volver al inicio
          </Link>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {loggingOut ? "Cerrando sesión..." : "Cerrar sesión y salir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href="/repartidor"
            className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            ← Inicio
          </Link>
          <div className="flex-1" />
        </div>

        <div>
          <h1 className="text-xl font-bold">Cerrar turno</h1>
          <p className="text-xs text-slate-400 mt-1">
            Turno abierto hace {elapsedSince(shift.startedAt)}
          </p>
        </div>

        {/* Blocked banner */}
        {blocked && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-2">
            <div className="text-sm font-semibold text-red-300">
              Tenés un pedido activo
            </div>
            <p className="text-xs text-red-300/80">
              Terminá el pedido {blockedOrderNumber ?? ""} antes de cerrar turno.
            </p>
            {blockedOrderId && (
              <Link
                href={`/repartidor/pedido/${blockedOrderId}`}
                className="inline-block rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Ir al pedido →
              </Link>
            )}
          </div>
        )}

        {/* Cash summary */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Efectivo al iniciar</span>
            <span className="text-slate-200">{formatARS(shift.cashOnHandStart)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Cobrado en el turno</span>
            <span className="text-slate-200">{formatARS(collectedTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2">
            <span className="text-slate-300 font-semibold">Efectivo esperado</span>
            <span className="text-white font-bold">{formatARS(expectedCash)}</span>
          </div>
        </div>

        {/* Input */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
          <label className="block">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
              Efectivo real en mano
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                disabled={submitting || blocked}
                className="w-full rounded-xl bg-slate-950 border border-white/10 pl-8 pr-3 py-3 text-xl font-bold text-white focus:border-orange-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            {input && (
              <div className="text-xs text-slate-500 mt-1">
                {formatARS(entered)}
              </div>
            )}
          </label>

          {input && !blocked && (
            <div
              className={`rounded-xl border p-3 text-center ${
                liveDiscrepancy === 0
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : liveDiscrepancy > 0
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <div
                className={`text-[10px] uppercase tracking-wider ${
                  liveDiscrepancy === 0
                    ? "text-emerald-400"
                    : liveDiscrepancy > 0
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                Diferencia
              </div>
              <div
                className={`text-2xl font-extrabold ${
                  liveDiscrepancy === 0
                    ? "text-emerald-400"
                    : liveDiscrepancy > 0
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {formatARS(liveDiscrepancy)}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none"
        >
          {submitting ? "Cerrando..." : "Cerrar turno"}
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          {loggingOut ? "Cerrando sesión..." : "Cerrar sesión y salir"}
        </button>
      </div>
    </div>
  );
}
