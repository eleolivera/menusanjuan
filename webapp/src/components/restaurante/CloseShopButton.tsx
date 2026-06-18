"use client";

import { useEffect, useState } from "react";

/**
 * Owner-side schedule override toggle. Four states depending on (scheduledOpen,
 * closedUntil, openUntil):
 *
 *   1. scheduled-open + nothing       → "Cerrar ahora" (red).      action: set closedUntil.
 *   2. scheduled-open + closedUntil   → "Reabrir" (green).         action: clear closedUntil.
 *   3. scheduled-closed + nothing     → "Abrir ahora" (orange).    action: set openUntil.
 *   4. scheduled-closed + openUntil   → "Cerrar override" (red).   action: clear openUntil.
 *
 * Both overrides expire at next-morning-5am AR, so the regular schedule
 * automatically resumes the next day — no manual cleanup required. closedUntil
 * still wins if both happened to be set (close beats open, fail-safe direction).
 */
export function CloseShopButton() {
  const [scheduledOpen, setScheduledOpen] = useState<boolean | null>(null);
  const [closedUntil, setClosedUntil] = useState<string | null>(null);
  const [openUntil, setOpenUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState<null | "close" | "open">(null);

  async function refresh() {
    try {
      const res = await fetch("/api/restaurante/profile");
      if (res.ok) {
        const d = await res.json();
        setScheduledOpen(Boolean(d.scheduledOpen));
        setClosedUntil(d.closedUntil || null);
        setOpenUntil(d.openUntil || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading || scheduledOpen === null) return null;

  const now = Date.now();
  const manuallyClosed = !!(closedUntil && new Date(closedUntil).getTime() > now);
  const manuallyOpen = !!(openUntil && new Date(openUntil).getTime() > now);

  function labelFor(iso: string | null): string | null {
    return iso
      ? new Date(iso).toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  }

  async function close() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurante/close-now", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setClosedUntil(d.closedUntil || null);
        setOpenUntil(null); // close-now currently doesn't touch openUntil but in case
        setShowConfirm(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearClose() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurante/close-now", { method: "DELETE" });
      if (res.ok) setClosedUntil(null);
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurante/open-now", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setOpenUntil(d.openUntil || null);
        setClosedUntil(null); // open-now clears closedUntil server-side
        setShowConfirm(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearOpen() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurante/open-now", { method: "DELETE" });
      if (res.ok) setOpenUntil(null);
    } finally {
      setBusy(false);
    }
  }

  // STATE 2 — scheduled-open + manually closed → Reabrir
  if (manuallyClosed) {
    return (
      <button
        type="button"
        onClick={clearClose}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        title={`Cerrado hasta ${labelFor(closedUntil)}`}
      >
        <span className="text-base leading-none">🔒</span>
        <span className="hidden sm:inline">Cerrado · {busy ? "..." : "Reabrir"}</span>
        <span className="sm:hidden">{busy ? "..." : "Reabrir"}</span>
      </button>
    );
  }

  // STATE 4 — scheduled-closed + manually opened → Volver a cerrar
  if (manuallyOpen) {
    return (
      <button
        type="button"
        onClick={clearOpen}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        title={`Abierto fuera de horario hasta ${labelFor(openUntil)}`}
      >
        <span className="text-base leading-none">🟢</span>
        <span className="hidden sm:inline">Abierto · {busy ? "..." : "Cerrar override"}</span>
        <span className="sm:hidden">{busy ? "..." : "Cerrar override"}</span>
      </button>
    );
  }

  // STATE 3 — scheduled-closed + no override → "Abrir ahora"
  if (!scheduledOpen) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowConfirm("open")}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          title="Abrir el local ahora aunque tu horario diga cerrado"
        >
          <span className="text-base leading-none">🟢</span>
          <span className="hidden sm:inline">Abrir ahora</span>
          <span className="sm:hidden">Abrir</span>
        </button>
        {showConfirm === "open" && (
          <ConfirmModal
            kind="open"
            busy={busy}
            onCancel={() => setShowConfirm(null)}
            onConfirm={open}
          />
        )}
      </>
    );
  }

  // STATE 1 — scheduled-open + no override → "Cerrar ahora"
  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm("close")}
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-colors"
        title="Cerrar el local por hoy (si te quedaste sin comida, etc.)"
      >
        <span className="text-base leading-none">🛑</span>
        <span className="hidden sm:inline">Cerrar ahora</span>
        <span className="sm:hidden">Cerrar</span>
      </button>
      {showConfirm === "close" && (
        <ConfirmModal
          kind="close"
          busy={busy}
          onCancel={() => setShowConfirm(null)}
          onConfirm={close}
        />
      )}
    </>
  );
}

function ConfirmModal({
  kind,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: "close" | "open";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isClose = kind === "close";
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="rounded-2xl bg-slate-900 border border-white/10 max-w-md w-full p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-5xl mb-2">{isClose ? "🛑" : "🟢"}</div>
          <h3 className="text-lg font-bold text-white">
            {isClose ? "¿Cerrar el local ahora?" : "¿Abrir el local ahora?"}
          </h3>
          <p className="text-sm text-slate-300 mt-2">
            {isClose
              ? "Los clientes van a ver el local como cerrado en MenuSanJuan y no van a poder hacer pedidos online."
              : "Los clientes van a poder hacer pedidos aunque tu horario diga que estás cerrado."}
          </p>
          <div className={`mt-3 rounded-xl border p-3 text-left ${isClose ? "border-amber-500/20 bg-amber-500/10" : "border-emerald-500/20 bg-emerald-500/10"}`}>
            <p className={`text-xs leading-relaxed ${isClose ? "text-amber-200" : "text-emerald-200"}`}>
              <strong>Importante:</strong>{" "}
              {isClose
                ? "el local va a quedar cerrado durante el resto de la jornada de hoy (incluso si tu horario pasa la medianoche). Mañana abre automáticamente según tu horario normal."
                : "vas a estar abierto hasta mañana a la mañana. Después vuelve automáticamente al horario normal."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50 ${
              isClose
                ? "bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/30 hover:shadow-lg"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30 hover:shadow-lg"
            }`}
          >
            {busy ? (isClose ? "Cerrando..." : "Abriendo...") : isClose ? "Sí, cerrar ahora" : "Sí, abrir ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
