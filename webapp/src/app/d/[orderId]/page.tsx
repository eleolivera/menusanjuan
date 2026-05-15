"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { PaymentCollector, type CollectedPayment } from "@/components/PaymentCollector";

type OrderItem = {
  itemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  optionsDelta?: number;
  note?: string;
  options?: Array<{ name: string }> | string[];
};

type DriverOrder = {
  id: string;
  orderNumber: string;
  restaurantName: string;
  restaurantLogo: string | null;
  restauranteSlug: string;
  status: string;
  paymentStatus: "PAID" | "UNPAID";
  paidAt: string | null;
  paymentMethod: string | null;
  deliveredAt: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  latitude: number | null;
  longitude: number | null;
  items: OrderItem[];
  total: number;
  deliveryFee: number;
  deliveryMethod: string;
  notes: string;
  createdAt: string;
};

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h}h`;
}

function formatPhoneForWhatsApp(phone: string): string {
  return phone.replace(/\D/g, "");
}

export default function DriverPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params.orderId;
  const token = searchParams.get("t");

  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  type ConfirmStep = null | "confirm" | "payment";
  const [step, setStep] = useState<ConfirmStep>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchOrder() {
    if (!orderId || !token) {
      setError("Link inválido");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/orders/driver/${orderId}?t=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setError("Pedido no encontrado o link expirado");
        setOrder(null);
      } else {
        const data: DriverOrder = await res.json();
        setOrder(data);
        setError(null);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
    // Poll for payment status changes — owner may mark paid while driver is en route
    pollerRef.current = setInterval(fetchOrder, 10000);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  async function markDelivered(extraPayment?: CollectedPayment) {
    if (!orderId || !token) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/orders/driver/${orderId}?t=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_delivered", ...(extraPayment || {}) }),
      });
      if (res.ok) {
        await fetchOrder();
        setStep(null);
      }
    } finally {
      setMarking(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Cargando...
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="text-sm font-semibold text-red-400 mb-1">{error || "Pedido no encontrado"}</div>
          <div className="text-xs text-slate-500">Pediles al restaurante un link nuevo.</div>
        </div>
      </div>
    );
  }

  const isDelivered = order.status === "DELIVERED";
  const totalDue = order.paymentStatus === "PAID" ? 0 : order.total + order.deliveryFee;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-5 space-y-3">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex items-center gap-3">
          {order.restaurantLogo && (
            <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-slate-800 shrink-0">
              <Image src={order.restaurantLogo} alt={order.restaurantName} fill className="object-cover" sizes="48px" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">Pedido</div>
            <div className="text-lg font-bold leading-tight">{order.orderNumber}</div>
            <div className="text-xs text-slate-400 truncate">{order.restaurantName}</div>
          </div>
        </div>

        {/* Payment status — the headline */}
        {order.paymentStatus === "PAID" ? (
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
            <div className="text-3xl mb-1">🟢</div>
            <div className="text-lg font-bold text-emerald-400">PAGADO</div>
            <div className="text-xs text-emerald-300/70 mt-1">
              {order.paymentMethod ? `${order.paymentMethod} · ` : ""}{timeAgo(order.paidAt)}
            </div>
            <div className="text-[11px] text-emerald-300/60 mt-1">No tenés que cobrar al cliente.</div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-5 text-center">
            <div className="text-3xl mb-1">🔴</div>
            <div className="text-lg font-bold text-red-400">COBRAR {formatARS(totalDue)}</div>
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
            href={`https://wa.me/${formatPhoneForWhatsApp(order.customerPhone)}`}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 hover:bg-emerald-500/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">📱</span>
              <span className="text-sm text-emerald-300 font-medium">{order.customerPhone}</span>
            </div>
            <span className="text-[10px] text-emerald-300/70">WhatsApp →</span>
          </a>
          {order.customerAddress && (
            <a
              href={
                order.latitude && order.longitude
                  ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
                  : `https://www.google.com/maps?q=${encodeURIComponent(order.customerAddress)}`
              }
              target="_blank"
              rel="noopener"
              className="flex items-start justify-between gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2.5 hover:bg-blue-500/15 transition-colors"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-blue-400 mt-0.5">📍</span>
                <span className="text-sm text-blue-300 leading-snug">{order.customerAddress}</span>
              </div>
              <span className="text-[10px] text-blue-300/70 shrink-0 mt-0.5">Maps →</span>
            </a>
          )}
          {order.notes && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
              <span className="font-semibold mr-1">📝 Notas:</span>{order.notes}
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
                <span className="text-slate-200 shrink-0">{formatARS((it.unitPrice + (it.optionsDelta || 0)) * it.quantity)}</span>
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
            <span>{formatARS(order.total + order.deliveryFee)}</span>
          </div>
        </div>

        {/* Action — multi-step depending on order state */}
        {isDelivered ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-sm font-bold text-emerald-400">Entregado</div>
            <div className="text-[11px] text-emerald-300/70 mt-1">{timeAgo(order.deliveredAt)}</div>
          </div>
        ) : step === null ? (
          <button
            onClick={() => setStep(order.paymentStatus === "PAID" ? "confirm" : "payment")}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
          >
            🟢 Marcar entregado
          </button>
        ) : step === "confirm" ? (
          // PAID order — just confirm delivery
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
            <div className="text-center text-sm text-emerald-200">¿Seguro que entregaste este pedido?</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep(null)}
                className="rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => markDelivered()}
                disabled={marking}
                className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {marking ? "..." : "Sí, entregado"}
              </button>
            </div>
          </div>
        ) : step === "payment" ? (
          <PaymentCollector
            total={totalDue}
            onCollect={(data) => markDelivered(data)}
            onCancel={() => setStep(null)}
            submitting={marking}
            confirmLabel="Cobrado y entregado"
            title="¿Cómo te pagó?"
          />
        ) : null}

        <div className="text-center text-[10px] text-slate-600 pt-1">
          MenuSanJuan · Página del repartidor
        </div>
      </div>
    </div>
  );
}
