"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Offer = {
  id: string;
  orderId: string;
  offeredAt: string;
  expiresAt: string;
  distanceKm: number | null;
  order: {
    id: string;
    orderNumber: string;
    restauranteName: string;
    restauranteSlug: string;
    deliveryFee: number;
    total: number;
    customerAddress: string | null;
  };
};

function formatCountdown(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function OffersList() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/network/driver/offers", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setOffers(Array.isArray(data.offers) ? data.offers : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // P4: push is the primary delivery channel; poll is the fallback for backgrounded push failure.
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function accept(offer: Offer) {
    if (busyId) return;
    setBusyId(offer.id);
    try {
      const res = await fetch(`/api/network/driver/offers/${offer.id}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.push(`/repartidor/pedido/${offer.orderId}`);
        router.refresh();
        return;
      }
      if (res.status === 409) {
        if (data.error === "already_has_order") {
          alert("Ya tenés un pedido en curso.");
        } else {
          alert("Ya lo tomó otro repartidor");
        }
        await refetch();
      } else {
        alert("No pudimos aceptar el pedido");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(offer: Offer) {
    if (busyId) return;
    setBusyId(offer.id);
    try {
      await fetch(`/api/network/driver/offers/${offer.id}/reject`, {
        method: "POST",
      });
    } catch {
      // ignore
    } finally {
      await refetch();
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
        Buscando pedidos...
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center">
        <div className="mb-3 text-3xl">🛵</div>
        <h3 className="mb-1 text-base font-semibold text-white">Sin ofertas por ahora</h3>
        <p className="text-sm text-slate-400">
          Te avisamos apenas haya un pedido cerca.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Ofertas ({offers.length})
      </h2>
      {offers.map((offer) => {
        const countdown = formatCountdown(offer.expiresAt, now);
        const expired = new Date(offer.expiresAt).getTime() - now <= 0;
        return (
          <div
            key={offer.id}
            className="rounded-2xl border border-primary/30 bg-gradient-to-br from-slate-900/80 to-slate-900/50 p-4 shadow-lg shadow-primary/5"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-white">
                  {offer.order.restauranteName}
                </div>
                {offer.order.customerAddress && (
                  <div className="mt-1 line-clamp-2 text-xs text-slate-400">
                    📍 {offer.order.customerAddress}
                  </div>
                )}
              </div>
              <div
                className={`flex-none rounded-lg px-2 py-1 font-mono text-xs font-semibold tabular-nums ${
                  expired
                    ? "bg-red-500/20 text-red-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {countdown}
              </div>
            </div>

            <div className="mb-4 flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500">Ganás </span>
                <span className="font-bold text-emerald-400">
                  ${Math.round(offer.order.deliveryFee).toLocaleString("es-AR")}
                </span>
              </div>
              {offer.distanceKm !== null && (
                <div>
                  <span className="text-slate-500">Distancia </span>
                  <span className="font-semibold text-white">
                    {offer.distanceKm.toFixed(1)} km
                  </span>
                </div>
              )}
              <div className="ml-auto text-slate-500">#{offer.order.orderNumber}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => reject(offer)}
                disabled={busyId === offer.id}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-60"
              >
                Rechazar
              </button>
              <button
                onClick={() => accept(offer)}
                disabled={busyId === offer.id || expired}
                className="flex-[2] rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-60"
              >
                {busyId === offer.id ? "Aceptando..." : "Aceptar"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
