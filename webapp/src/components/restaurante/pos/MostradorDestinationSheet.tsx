"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { LocationPicker } from "@/components/LocationPicker";
import { calculateDeliveryFee, type DeliveryConfig } from "@/lib/delivery";

export type MostradorDestination = {
  deliveryMethod: "pickup" | "delivery";
  customerPhone?: string;
  customerAddress?: string;
  deliveryFee?: number;
  customerLat?: number | null;
  customerLng?: number | null;
};

/**
 * Asks the owner: is this open mostrador order for pickup at counter, or for delivery?
 * If delivery, opens LocationPicker (fullscreen map flow) to capture the customer's
 * address; the delivery fee is auto-calculated from the configured zones.
 * Triggered after the owner taps "Mandar a cocina" on a phone order.
 */
export function MostradorDestinationSheet({
  customerName,
  total,
  onConfirm,
  onCancel,
  submitting = false,
  deliveryConfig,
}: {
  customerName: string;
  total: number;
  onConfirm: (data: MostradorDestination) => void;
  onCancel: () => void;
  submitting?: boolean;
  deliveryConfig: DeliveryConfig | null;
}) {
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [autoZoneLabel, setAutoZoneLabel] = useState<string | null>(null);
  const [autoDistanceKm, setAutoDistanceKm] = useState<number | null>(null);
  const [outOfRange, setOutOfRange] = useState(false);

  const canConfirm = method === "pickup" || address.trim().length > 0;

  function handleAddressConfirm(addr: string, lat: number, lng: number) {
    setAddress(addr);
    setCoords({ lat, lng });
    setOutOfRange(false);
    setAutoZoneLabel(null);
    setAutoDistanceKm(null);

    if (!deliveryConfig) return;

    const result = calculateDeliveryFee(deliveryConfig, lat, lng);
    if (!result) return;

    setAutoDistanceKm(result.distanceKm);

    if (result.fee == null) {
      // Out of range — keep the address but warn
      setOutOfRange(true);
      return;
    }

    // Don't auto-fill the fee — the cashier types it themselves each time.
    // We still surface zone + distance below the input as informational hint.
    if (result.zoneIndex != null) {
      setAutoZoneLabel(`Zona ${result.zoneIndex + 1} · sugerido $${result.fee.toLocaleString("es-AR")}`);
    } else {
      setAutoZoneLabel(`Tarifa fija sugerida · $${result.fee.toLocaleString("es-AR")}`);
    }
  }

  function confirm() {
    if (!canConfirm || submitting) return;
    if (method === "delivery") {
      onConfirm({
        deliveryMethod: "delivery",
        customerPhone: phone.trim() || undefined,
        customerAddress: address.trim() || undefined,
        customerLat: coords?.lat ?? null,
        customerLng: coords?.lng ?? null,
        deliveryFee: fee ?? 0,
      });
    } else {
      onConfirm({ deliveryMethod: "pickup" });
    }
  }

  const hasZonesConfigured =
    deliveryConfig &&
    (((deliveryConfig.deliveryZones?.length ?? 0) > 0) ||
      (deliveryConfig.deliveryFee != null && deliveryConfig.deliveryFee > 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-md max-h-[95vh] bg-slate-950 rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">¿Cómo lo retira?</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {customerName ? `${customerName} · ` : ""}${total.toLocaleString("es-AR")}
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white text-2xl px-2" disabled={submitting}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4" style={{ minHeight: 0 }}>
          {/* Method toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("pickup")}
              className={`rounded-xl border-2 px-3 py-4 flex flex-col items-center gap-1 transition-all ${
                method === "pickup"
                  ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">🏪</span>
              <span className="text-sm font-bold">Retiro</span>
              <span className="text-[10px] opacity-70">en el local</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("delivery")}
              className={`rounded-xl border-2 px-3 py-4 flex flex-col items-center gap-1 transition-all ${
                method === "delivery"
                  ? "border-orange-400/50 bg-orange-400/10 text-orange-300"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">🛵</span>
              <span className="text-sm font-bold">Delivery</span>
              <span className="text-[10px] opacity-70">a domicilio</span>
            </button>
          </div>

          {method === "delivery" && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  📱 WhatsApp del cliente
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="264 555 1234"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
                />
              </div>

              {/* Address via LocationPicker — same flow customers use */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <LocationPicker
                  addressLabel="📍 Dirección del cliente"
                  placeholder="Escribí la dirección del cliente..."
                  geolocateLabel="Marcar en mapa"
                  initialAddress={address}
                  initialLat={coords?.lat ?? null}
                  initialLng={coords?.lng ?? null}
                  onLocationConfirm={handleAddressConfirm}
                />
              </div>

              {outOfRange && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                  ⚠️ La dirección está fuera de tu zona de delivery
                  {autoDistanceKm != null ? ` (${autoDistanceKm.toFixed(1)} km)` : ""}. Podés cobrarle un envío manual si igual querés despachar.
                </div>
              )}

              <div>
                <MoneyInput
                  label="💰 Envío"
                  value={fee}
                  onChange={setFee}
                  placeholder="2500"
                  darkMode
                />
                {autoZoneLabel && autoDistanceKm != null && !outOfRange && (
                  <p className="text-[11px] text-emerald-300 mt-1">
                    💡 {autoZoneLabel} · {autoDistanceKm.toFixed(1)} km — cargá el monto que querés cobrar
                  </p>
                )}
                {!hasZonesConfigured && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    No tenés zonas configuradas. Cargá el envío a mano o configurá zonas en Mi Restaurante.
                  </p>
                )}
              </div>
            </div>
          )}

          {method === "pickup" && (
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/5 px-4 py-3 text-xs text-indigo-200">
              El cliente va a retirar el pedido en el local. Va a cocina sin pago, se cobra después.
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/5 p-3">
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm || submitting}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
          >
            {submitting
              ? "Procesando..."
              : "📋 Mandar a cocina · cobrar después"}
          </button>
          {method === "delivery" && !address.trim() && (
            <p className="text-[11px] text-amber-300 text-center mt-2">
              Falta la dirección para mandar a cocina como delivery.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
