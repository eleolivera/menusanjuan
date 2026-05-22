"use client";

import { useEffect, useState } from "react";

/**
 * Owner action — manually close the restaurant for the rest of the current
 * service session (e.g. ran out of food). Hits POST /api/restaurante/close-now
 * which sets `closedUntil` to next morning 5am AR — guaranteed to outlast any
 * sane late-night close, so the early close survives midnight rollover and
 * the regular schedule resumes the next day automatically.
 *
 * Three visual states:
 *   - "Cerrar ahora"   — default (resta currently open or scheduled to open)
 *   - "Reabrir"        — when closedUntil > now (resta is manually closed)
 *   - confirmation modal in between to prevent accidental taps
 */
export function CloseShopButton() {
  const [closedUntil, setClosedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/restaurante/profile");
      if (res.ok) {
        const d = await res.json();
        setClosedUntil(d.closedUntil || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Detect if closedUntil is still in the future
  const closed = closedUntil ? new Date(closedUntil).getTime() > Date.now() : false;
  const reopenLabel = closedUntil
    ? new Date(closedUntil).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  async function closeNow() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurante/close-now", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setClosedUntil(d.closedUntil || null);
        setShowConfirm(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurante/close-now", { method: "DELETE" });
      if (res.ok) {
        setClosedUntil(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (closed) {
    return (
      <button
        type="button"
        onClick={reopen}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        title={reopenLabel ? `Cerrado hasta ${reopenLabel}` : undefined}
      >
        <span className="text-base leading-none">🔒</span>
        <span className="hidden sm:inline">
          Cerrado · {busy ? "..." : "Reabrir"}
        </span>
        <span className="sm:hidden">{busy ? "..." : "Reabrir"}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-colors"
        title="Cerrar el local por hoy (si te quedaste sin comida, etc.)"
      >
        <span className="text-base leading-none">🛑</span>
        <span className="hidden sm:inline">Cerrar ahora</span>
        <span className="sm:hidden">Cerrar</span>
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !busy && setShowConfirm(false)}
        >
          <div
            className="rounded-2xl bg-slate-900 border border-white/10 max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-5xl mb-2">🛑</div>
              <h3 className="text-lg font-bold text-white">¿Cerrar el local ahora?</h3>
              <p className="text-sm text-slate-300 mt-2">
                Los clientes van a ver el local como cerrado en MenuSanJuan y no van a poder hacer pedidos online.
              </p>
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left">
                <p className="text-xs text-amber-200 leading-relaxed">
                  <strong>Importante:</strong> el local va a quedar cerrado durante el resto de la jornada de hoy
                  (incluso si tu horario pasa la medianoche). Mañana abre automáticamente según tu horario normal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={busy}
                className="rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={closeNow}
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 py-3 text-sm font-bold text-white shadow-md shadow-red-500/30 hover:shadow-lg transition-all disabled:opacity-50"
              >
                {busy ? "Cerrando..." : "Sí, cerrar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
