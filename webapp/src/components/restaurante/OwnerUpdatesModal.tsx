"use client";

import { useEffect, useState } from "react";
import type { OwnerUpdate } from "@/lib/changelog";

/**
 * Modal that pops up automatically in the owner portal the first time the owner
 * loads a page after a new "Novedades" entry was added to `src/lib/changelog.ts`.
 *
 * Flow:
 *   1. Fetch unseen updates from /api/restaurante/updates (newest-first).
 *   2. Show the first one with an "Entendido" button.
 *   3. Click → POST to /api/restaurante/updates with the id → server stores
 *      it on Dealer.lastSeenUpdate, then we advance to the next unseen one.
 *   4. Once all are acknowledged, the modal hides until the next time the
 *      changelog grows.
 *
 * Mounted in DashboardShell so every owner-portal page picks it up.
 */
export function OwnerUpdatesModal() {
  const [updates, setUpdates] = useState<OwnerUpdate[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/restaurante/updates")
      .then((r) => (r.ok ? r.json() : { unseen: [] }))
      .then((d) => { if (!cancelled) setUpdates(d.unseen || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (updates.length === 0) return null;
  const current = updates[0];
  const remaining = updates.length;

  async function acknowledge() {
    setBusy(true);
    try {
      await fetch("/api/restaurante/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id }),
      });
      setUpdates((prev) => prev.slice(1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-slate-900 border border-white/10 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/20 to-amber-500/20 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{current.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-bold">
                Novedades · {current.date}
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">{current.title}</h2>
            </div>
            {remaining > 1 && (
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                {remaining} novedades
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {current.body}
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900 border-t border-white/10 px-5 py-3.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            {remaining > 1 ? "Quedan más novedades — las vas viendo de a una." : "Esta es la última novedad pendiente."}
          </p>
          <button
            type="button"
            onClick={acknowledge}
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/30 hover:shadow-lg transition-all disabled:opacity-50"
          >
            {busy ? "..." : remaining > 1 ? "Entendido — siguiente" : "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
