"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/orders-store";

// --- Local shape overlay -----------------------------------------------------
// Task B extends the `Order` type in orders-store with the driver fields
// (`assignedDriver`, `latestOffer`, `pickedUpAt`, `assignedDriverId`). Until
// that lands, we read them via a permissive overlay so this file compiles on
// its own and keeps working after B merges.
type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

type DriverInfo = {
  id: string;
  displayName: string;
  currentLat: number | null;
  currentLng: number | null;
};

type LatestOffer = {
  id: string;
  status: OfferStatus;
  offeredAt: string;
  expiresAt: string;
  distanceKm: number | null;
};

type OrderWithDriver = Order & {
  assignedDriverId?: string | null;
  assignedDriver?: DriverInfo | null;
  latestOffer?: LatestOffer | null;
  pickedUpAt?: string | null;
};

// Maps server-side dispatch reasons to Spanish user-facing copy.
function reasonToSpanish(reason: string | undefined): string {
  switch (reason) {
    case "manual_mode":
      return "Este restaurante no usa la red de delivery.";
    case "not_delivery":
      return "El pedido es para retirar en el local.";
    case "already_delivered":
      return "Este pedido ya fue entregado.";
    case "already_dispatched":
      return "Ya hay una búsqueda de repartidor en curso.";
    case "no_drivers_available":
      return "No hay repartidores disponibles ahora. Reintentá en un minuto.";
    case "not_your_order":
      return "No tenés permiso para este pedido.";
    default:
      return reason
        ? `No pudimos enviar a delivery: ${reason}`
        : "No se pudo enviar a delivery. Reintentá.";
  }
}

function formatElapsed(fromIso: string, now: number): string {
  const diffMs = now - new Date(fromIso).getTime();
  const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
  const mm = Math.floor(totalSecs / 60);
  const ss = totalSecs % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

function formatHHmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DriverChip({
  order,
  deliveryMode,
  onDispatched,
}: {
  order: OrderWithDriver;
  deliveryMode: string;
  onDispatched: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Ticks every second so the "hace mm:ss" label stays live between the 10 s
  // parent polls. Only mounted for the PENDING branch — see effect below.
  const [now, setNow] = useState(() => Date.now());

  const isPendingSearch =
    !order.assignedDriver &&
    order.latestOffer?.status === "PENDING" &&
    new Date(order.latestOffer.expiresAt).getTime() > Date.now();

  useEffect(() => {
    if (!isPendingSearch) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isPendingSearch]);

  // Precondition — never rendered otherwise, but guarded here as belt-and-suspenders.
  if (deliveryMode === "MANUAL" || order.deliveryMethod !== "delivery") {
    return null;
  }

  async function handleDispatch() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/restaurante/orders/${order.id}/dispatch`,
        { method: "POST" },
      );
      if (res.ok) {
        onDispatched();
        return;
      }
      let reason: string | undefined;
      try {
        const body = await res.json();
        reason = body?.reason ?? body?.error;
      } catch {
        // ignore parse errors
      }
      window.alert(reasonToSpanish(reason));
    } catch (err) {
      console.error("dispatch failed:", err);
      window.alert("No se pudo enviar a delivery. Revisá tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  const driver = order.assignedDriver ?? null;
  const offer = order.latestOffer ?? null;
  const offerExpired =
    offer?.status === "EXPIRED" ||
    (offer?.status === "PENDING" &&
      new Date(offer.expiresAt).getTime() <= Date.now());

  // --- (f) Delivered -------------------------------------------------------
  if (order.status === "DELIVERED" && driver) {
    return (
      <div className="rounded-xl border border-slate-500/20 bg-slate-500/15 px-3 py-2 text-xs font-semibold text-slate-400">
        ✅ Entregado por {driver.displayName}
      </div>
    );
  }

  // --- (e) Picked up -------------------------------------------------------
  if (driver && order.pickedUpAt && order.status !== "DELIVERED") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs">
        <div className="font-semibold text-emerald-300">
          🛵 {driver.displayName} — Retiró el pedido
        </div>
        <div className="mt-0.5 text-[11px] text-emerald-300/70">
          {formatHHmm(order.pickedUpAt)}
        </div>
      </div>
    );
  }

  // --- (d) Driver assigned, en route to store ------------------------------
  if (driver && !order.pickedUpAt && order.status !== "DELIVERED") {
    const km = offer?.distanceKm;
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs">
        <div className="font-semibold text-emerald-300">
          🛵 {driver.displayName}
        </div>
        <div className="mt-0.5 text-[11px] text-emerald-300/70">
          En camino al local
          {typeof km === "number" ? ` · ${km.toFixed(1)} km` : ""}
        </div>
      </div>
    );
  }

  // --- (b) Searching (PENDING, not yet expired) ----------------------------
  if (isPendingSearch && offer) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs animate-pulse">
        <div className="font-semibold text-amber-300">
          🛵 Buscando repartidor...
        </div>
        <div className="mt-0.5 text-[11px] text-amber-300/70">
          hace {formatElapsed(offer.offeredAt, now)}
        </div>
      </div>
    );
  }

  // --- (c) Retry after expired/failed offer --------------------------------
  if (offer && (offerExpired || offer.status === "EXPIRED")) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2.5 space-y-2">
        <button
          type="button"
          onClick={handleDispatch}
          disabled={busy}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Enviando..." : "🛵 Reintentar delivery"}
        </button>
        <div className="text-[11px] text-amber-200">
          El repartidor anterior no aceptó — reintentá
        </div>
      </div>
    );
  }

  // --- (a) Initial state — no offer, no driver -----------------------------
  return (
    <button
      type="button"
      onClick={handleDispatch}
      disabled={busy}
      className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? "Enviando..." : "🛵 Enviar a delivery"}
    </button>
  );
}
