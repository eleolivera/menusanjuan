"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PaymentCollector, type CollectedPayment } from "@/components/PaymentCollector";

type Item = {
  name: string;
  quantity: number;
  unitPrice: number;
  optionsDelta?: number;
  note?: string;
};

type Props = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: "UNPAID" | "PAID" | "PAID_UNVERIFIED";
    customerName: string;
    customerPhone: string;
    customerAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    items: Item[];
    total: number;
    deliveryFee: number;
    notes: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    restaurantName: string;
    restaurantLogo: string | null;
  };
};

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

function stripPhone(p: string): string {
  return p.replace(/\D/g, "");
}

function buildMapsUrl(address: string | null, lat: number | null, lng: number | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address ?? "")}`;
}

export function PedidoClient({ order }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmDelivered, setConfirmDelivered] = useState(false);

  const isDelivered = order.status === "DELIVERED";
  const isPickedUp = !!order.pickedUpAt;
  const totalWithDelivery = order.total + order.deliveryFee;

  async function handlePickup() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/network/driver/orders/${order.id}/pickup`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error === "not_assigned_or_already_picked" ? "Ya lo retiraste o no está asignado a vos" : "No se pudo actualizar");
      } else {
        router.refresh();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  async function markDelivered(payment?: CollectedPayment) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (payment) {
        body.paymentMethod = payment.paymentMethod;
        if (payment.cashTendered != null) body.cashTendered = payment.cashTendered;
        if (payment.cashChange != null) body.cashChange = payment.cashChange;
        body.cashCollected = payment.paymentMethod === "cash" ? Math.round(totalWithDelivery) : 0;
      }
      const res = await fetch(`/api/network/driver/orders/${order.id}/delivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "No se pudo marcar entregado");
        setSubmitting(false);
        return;
      }
      router.push("/repartidor");
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-5 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/repartidor")}
            className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            ← Inicio
          </button>
          <div className="flex-1 text-right text-[11px] text-slate-500">Pedido</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex items-center gap-3">
          {order.restaurantLogo ? (
            <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-slate-800 shrink-0">
              <Image src={order.restaurantLogo} alt={order.restaurantName} fill className="object-cover" sizes="48px" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl bg-slate-800 shrink-0 flex items-center justify-center text-lg">🍔</div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">N°</div>
            <div className="text-lg font-bold leading-tight">{order.orderNumber}</div>
            <div className="text-xs text-slate-400 truncate">{order.restaurantName}</div>
          </div>
        </div>

        {/* Payment status */}
        {order.paymentStatus === "PAID" ? (
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
            <div className="text-2xl mb-1">🟢</div>
            <div className="text-base font-bold text-emerald-400">Ya está pagado</div>
            <div className="text-[11px] text-emerald-300/70 mt-1">No cobrarle al cliente.</div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-4 text-center">
            <div className="text-2xl mb-1">🔴</div>
            <div className="text-base font-bold text-red-400">A cobrar: {formatARS(totalWithDelivery)}</div>
            <div className="text-[11px] text-red-300/70 mt-1">El cliente paga al recibir.</div>
          </div>
        )}

        {/* Customer */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-0.5">Cliente</div>
            <div className="text-sm font-semibold">{order.customerName}</div>
          </div>
          <a
            href={`tel:${stripPhone(order.customerPhone)}`}
            className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 hover:bg-emerald-500/15"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">📞</span>
              <span className="text-sm text-emerald-300 font-medium">{order.customerPhone}</span>
            </div>
            <span className="text-[10px] text-emerald-300/70">Llamar →</span>
          </a>
          <a
            href={`https://wa.me/${stripPhone(order.customerPhone)}`}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 hover:bg-emerald-500/10"
          >
            <span className="text-xs text-emerald-300/80">💬 Abrir WhatsApp</span>
            <span className="text-[10px] text-emerald-300/60">→</span>
          </a>
          {order.customerAddress && (
            <a
              href={buildMapsUrl(order.customerAddress, order.latitude, order.longitude)}
              target="_blank"
              rel="noopener"
              className="flex items-start justify-between gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2.5 hover:bg-blue-500/15"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-blue-400 mt-0.5">📍</span>
                <span className="text-sm text-blue-300 leading-snug">{order.customerAddress}</span>
              </div>
              <span className="text-[10px] text-blue-300/70 shrink-0 mt-0.5">Abrir en Maps →</span>
            </a>
          )}
          {order.notes && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
              <span className="font-semibold mr-1">📝 Notas:</span>
              {order.notes}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-2">Pedido</div>
          <div className="space-y-1.5">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-300">
                  {it.quantity}× {it.name}
                  {it.note && <span className="block text-[10px] text-slate-500 italic">{it.note}</span>}
                </span>
                <span className="text-slate-200 shrink-0">
                  {formatARS((it.unitPrice + (it.optionsDelta || 0)) * it.quantity)}
                </span>
              </div>
            ))}
          </div>
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-white/5">
              <span>Envío</span>
              <span>{formatARS(order.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-white/10">
            <span>Total</span>
            <span>{formatARS(totalWithDelivery)}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Action buttons */}
        {isDelivered ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-sm font-bold text-emerald-400">Entregado</div>
          </div>
        ) : !isPickedUp ? (
          <button
            onClick={handlePickup}
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-50"
          >
            {submitting ? "Actualizando..." : "📦 Retiré el pedido"}
          </button>
        ) : order.paymentStatus === "PAID" ? (
          !confirmDelivered ? (
            <button
              onClick={() => setConfirmDelivered(true)}
              disabled={submitting}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              🟢 Entregué el pedido
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
              <div className="text-center text-sm text-emerald-200">¿Confirmás la entrega?</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmDelivered(false)}
                  disabled={submitting}
                  className="rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => markDelivered()}
                  disabled={submitting}
                  className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {submitting ? "..." : "Sí, entregado"}
                </button>
              </div>
            </div>
          )
        ) : (
          <>
            <button
              onClick={() => setShowPayment(true)}
              disabled={submitting}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              💵 Entregué el pedido
            </button>
            {showPayment && (
              <PaymentCollector
                layout="modal"
                total={totalWithDelivery}
                onCollect={async (data) => {
                  await markDelivered(data);
                }}
                onCancel={() => setShowPayment(false)}
                submitting={submitting}
                confirmLabel="Cobrado y entregado"
                title="¿Cómo te pagó?"
              />
            )}
          </>
        )}

        <div className="text-center text-[10px] text-slate-600 pt-1">
          MenuSanJuan · Repartidor
        </div>
      </div>
    </div>
  );
}
