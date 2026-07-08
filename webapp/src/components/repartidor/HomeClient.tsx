"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShiftToggle } from "./ShiftToggle";
import { LocationTracker } from "./LocationTracker";
import { PushRegistrar } from "./PushRegistrar";
import { OffersList } from "./OffersList";
import { ActiveOrderCard } from "./ActiveOrderCard";
import { CashTile } from "./CashTile";

type Driver = {
  id: string;
  displayName: string;
  vehicleType: string | null;
};

type ActiveShift = {
  id: string;
  startedAt: string;
  cashOnHandStart: number;
};

type ActiveOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerAddress: string | null;
  total: number;
  deliveryFee: number;
  pickedUpAt: string | null;
  restaurantName: string;
};

type Props = {
  driver: Driver;
  activeShift: ActiveShift | null;
  activeOrder: ActiveOrder | null;
  cashInHand: number;
};

export function HomeClient({ driver, activeShift, activeOrder, cashInHand }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onShift = !!activeShift;

  async function startShift() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/network/driver/shift/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashOnHandStart: 0 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No pudimos iniciar el turno");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError("Error de conexión");
      setBusy(false);
    }
  }

  function endShift() {
    router.push("/repartidor/cerrar-turno");
  }

  async function logout() {
    if (onShift) {
      alert("Cerrá el turno antes de salir.");
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/network/driver/session", { method: "DELETE" });
    } catch {
      // ignore
    }
    router.push("/repartidor/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-lg font-bold">
              {driver.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{driver.displayName}</div>
              <div className="text-xs text-slate-500">
                {driver.vehicleType ?? "Repartidor"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <ShiftToggle
          onShift={onShift}
          startedAt={activeShift?.startedAt ?? null}
          onStart={startShift}
          onEnd={endShift}
          busy={busy}
        />

        {onShift && (
          <CashTile amountArs={cashInHand} />
        )}

        {onShift && activeOrder && (
          <ActiveOrderCard order={activeOrder} />
        )}

        {onShift && !activeOrder && <OffersList />}

        {!onShift && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center">
            <div className="mb-3 text-3xl">🕒</div>
            <h3 className="mb-1 text-base font-semibold text-white">Turno cerrado</h3>
            <p className="text-sm text-slate-400">
              Iniciá turno para recibir ofertas de pedidos cerca tuyo.
            </p>
          </div>
        )}
      </main>

      {onShift && <LocationTracker active={onShift} />}
      {onShift && <PushRegistrar active={onShift} />}
    </div>
  );
}
