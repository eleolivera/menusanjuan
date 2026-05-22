"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getAllOrderRefs } from "@/lib/order-tracker";
import { OrderStatusStepper } from "@/components/OrderStatusStepper";
import { ComprobanteUploader } from "@/components/ComprobanteUploader";

type OrderStatus = "GENERATED" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PAID_UNVERIFIED" | "PAID";

type TrackedOrder = {
  orderId: string;
  token: string;
  orderNumber: string;
  slug: string;
  placedAt: string;
  // Fetched from API
  status?: OrderStatus;
  restaurantName?: string;
  restaurantLogo?: string;
  total?: number;
  items?: any[];
  deliveryMethod?: string;
  deliveryFee?: number;
  paymentStatus?: PaymentStatus;
  paymentIntent?: string | null;
  paymentReceiptUrl?: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  GENERATED: "Enviado",
  PAID: "Pagado",
  PROCESSING: "En preparación",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export default function MisPedidosPage() {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (isInitial = false) => {
    const refs = getAllOrderRefs();
    if (refs.length === 0) {
      setOrders([]);
      if (isInitial) setLoading(false);
      return;
    }

    const results = await Promise.all(
      refs.map(async (ref) => {
        try {
          const res = await fetch(`/api/orders/track?id=${ref.orderId}&token=${ref.token}`);
          if (res.ok) {
            const data = await res.json();
            return {
              ...ref,
              status: data.status as OrderStatus,
              restaurantName: data.restaurantName,
              restaurantLogo: data.restaurantLogo,
              total: data.total,
              items: data.items,
              deliveryMethod: data.deliveryMethod,
              deliveryFee: data.deliveryFee,
              paymentStatus: data.paymentStatus as PaymentStatus,
              paymentIntent: data.paymentIntent,
              paymentReceiptUrl: data.paymentReceiptUrl,
            };
          }
        } catch {}
        return { ...ref } as TrackedOrder;
      })
    );

    setOrders(results);
    if (isInitial) setLoading(false);

    // Stop polling if no pending orders left
    const hasPending = results.some((o) => o.status && !["DELIVERED", "CANCELLED"].includes(o.status!));
    if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchOrders(true);
    pollRef.current = setInterval(() => fetchOrders(), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  const pending = orders.filter((o) => o.status && !["DELIVERED", "CANCELLED"].includes(o.status));
  const completed = orders.filter((o) => o.status && ["DELIVERED", "CANCELLED"].includes(o.status));

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border/50">
        <div className="mx-auto max-w-lg flex items-center gap-3 px-4 py-3">
          <Link href="/" className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            <svg className="h-5 w-5 text-text" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-text">Mis Pedidos</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-text mb-2">No tenés pedidos</h2>
            <p className="text-sm text-text-secondary mb-6">
              Cuando hagas un pedido en cualquier restaurante, va a aparecer acá.
            </p>
            <Link
              href="/#restaurantes"
              className="inline-block rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all"
            >
              Ver restaurantes
            </Link>
          </div>
        ) : (
          <>
            {/* Pending orders */}
            {pending.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">En curso</h2>
                <div className="space-y-3">
                  {pending.map((order) => (
                    <OrderCard key={order.orderId} order={order} expanded={expanded === order.orderId} onToggle={() => setExpanded(expanded === order.orderId ? null : order.orderId)} onRefresh={() => fetchOrders()} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed orders */}
            {completed.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Anteriores</h2>
                <div className="space-y-3">
                  {completed.map((order) => (
                    <OrderCard key={order.orderId} order={order} expanded={expanded === order.orderId} onToggle={() => setExpanded(expanded === order.orderId ? null : order.orderId)} onRefresh={() => fetchOrders()} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, expanded, onToggle, onRefresh }: { order: TrackedOrder; expanded: boolean; onToggle: () => void; onRefresh: () => void }) {
  const isPending = order.status && !["DELIVERED", "CANCELLED"].includes(order.status);
  const timeAgo = getTimeAgo(order.placedAt);

  // Comprobante eligibility: customer picked transfer/MP at checkout, total is
  // finalized (delivery fee known or pickup), and payment isn't already PAID
  // (cashier validated). PAID_UNVERIFIED still allows replacement uploads.
  const wantsTransferOrMP = order.paymentIntent === "transfer" || order.paymentIntent === "mercadopago";
  const totalFinalized = order.deliveryMethod === "pickup" || (order.deliveryFee != null && order.deliveryFee > 0) || order.deliveryMethod !== "delivery";
  const canUploadReceipt =
    wantsTransferOrMP &&
    totalFinalized &&
    order.paymentStatus !== "PAID" &&
    isPending;
  const paymentBadge =
    order.paymentStatus === "PAID" ? { label: "Pagado", cls: "bg-emerald-50 text-emerald-700" } :
    order.paymentStatus === "PAID_UNVERIFIED" ? { label: "Validando…", cls: "bg-amber-50 text-amber-700" } :
    null;

  return (
    <div className={`rounded-2xl border bg-white shadow-sm transition-all ${isPending ? "border-primary/20" : "border-border/50"}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        {/* Restaurant logo */}
        <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-amber-100">
          {order.restaurantLogo ? (
            <img src={order.restaurantLogo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-lg font-bold text-primary">
              {(order.restaurantName || order.slug).charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text truncate">{order.restaurantName || order.slug}</div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{order.orderNumber}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            {order.total && (
              <>
                <span>·</span>
                <span className="font-semibold text-text">${order.total.toLocaleString("es-AR")}</span>
              </>
            )}
          </div>
        </div>

        {/* Status + payment badges */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {order.status && (
            <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
              order.status === "DELIVERED" ? "bg-emerald-50 text-emerald-700" :
              order.status === "CANCELLED" ? "bg-red-50 text-red-700" :
              order.status === "PROCESSING" ? "bg-amber-50 text-amber-700" :
              "bg-primary/10 text-primary"
            }`}>
              {STATUS_LABELS[order.status]}
            </span>
          )}
          {paymentBadge && (
            <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold ${paymentBadge.cls}`}>
              {paymentBadge.label}
            </span>
          )}
        </div>
      </button>

      {/* Expanded view */}
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          {/* Status stepper */}
          {order.status && (
            <div className="mb-4">
              <OrderStatusStepper status={order.status} />
            </div>
          )}

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-surface-alt p-3 mb-3">
              {order.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span className="text-text-secondary">{item.quantity}x {item.name}</span>
                  <span className="font-medium text-text">${item.total?.toLocaleString("es-AR")}</span>
                </div>
              ))}
            </div>
          )}

          {/* Comprobante uploader — only when transfer/MP + total finalized + not PAID */}
          {canUploadReceipt && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                {order.paymentStatus === "PAID_UNVERIFIED" ? "Comprobante enviado" : "¿Ya transferiste?"}
              </div>
              {order.paymentStatus === "PAID_UNVERIFIED" && order.paymentReceiptUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={order.paymentReceiptUrl} alt="Comprobante" className="w-full max-h-48 rounded-lg object-contain bg-black/5" />
                  <div className="text-[11px] text-emerald-700">
                    El restaurante está revisando tu comprobante. Lo vas a ver acá cuando lo confirmen.
                  </div>
                  <Link
                    href={`/pagar/${order.orderId}?t=${order.token}`}
                    className="block text-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                  >
                    Reemplazar comprobante
                  </Link>
                </div>
              ) : (
                <ComprobanteUploader
                  mode="post-order"
                  orderId={order.orderId}
                  customerAccessToken={order.token}
                  onUploaded={() => onRefresh()}
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Link
              href={`/${order.slug}`}
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-center text-xs font-semibold text-text hover:bg-surface-hover transition-colors"
            >
              Ver restaurante
            </Link>
            {isPending && (
              <Link
                href={`/${order.slug}`}
                className="flex-1 rounded-xl bg-[#25D366] px-4 py-2.5 text-center text-xs font-bold text-white transition-colors"
              >
                Contactar
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}
