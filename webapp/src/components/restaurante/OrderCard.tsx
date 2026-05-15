"use client";

import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/orders-store";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; emoji: string; bg: string; text: string; next?: OrderStatus; nextLabel?: string }
> = {
  GENERATED: {
    label: "Nuevo",
    emoji: "📝",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    next: "PROCESSING",
    nextLabel: "Enviar a Cocina",
  },
  PAID: {
    // Legacy status — pre-existing orders may still be here. Treat like GENERATED for new transitions.
    label: "Pagado",
    emoji: "💰",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    next: "PROCESSING",
    nextLabel: "Enviar a Cocina",
  },
  PROCESSING: {
    label: "En Cocina",
    emoji: "🔄",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    next: "DELIVERED",
    nextLabel: "Marcar Entregado",
  },
  DELIVERED: {
    label: "Entregado",
    emoji: "✅",
    bg: "bg-slate-500/15",
    text: "text-slate-400",
  },
  CANCELLED: {
    label: "Cancelado",
    emoji: "❌",
    bg: "bg-red-500/15",
    text: "text-red-400",
  },
};

export function OrderCard({
  order,
  onUpdateStatus,
  restaurantName,
}: {
  order: Order;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  restaurantName: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const config = STATUS_CONFIG[order.status];
  const timeSince = getTimeSince(order.createdAt);

  const cleanPhone = order.customerPhone.replace(/[^0-9]/g, "");
  const hasPhone = cleanPhone.length >= 8;
  const whatsappUrl = hasPhone ? `https://wa.me/${cleanPhone}` : null;
  const mapsUrl =
    order.latitude && order.longitude
      ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
      : order.customerAddress
        ? `https://www.google.com/maps/search/${encodeURIComponent(order.customerAddress)}`
        : null;

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden transition-all hover:border-white/10">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
              {config.emoji} {config.label}
            </span>
            <span className="text-sm font-bold text-white truncate">
              {order.orderNumber}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold text-white">
              ${order.total.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-slate-500">{timeSince}</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
          <span>{order.customerName}</span>
          <span>·</span>
          <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
          {order.whatsappSent && (
            <>
              <span>·</span>
              <span className="text-green-500">WhatsApp enviado</span>
            </>
          )}
        </div>
      </div>

      {/* Order details (compact, app-styled — receipt itself lives at /restaurante/order/[id]/ticket) */}
      <div className="border-t border-white/5 px-4 py-4 space-y-4">
        {/* Items */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Items</div>
          {(() => {
            const batches: Record<string, any[]> = {};
            const keys: string[] = [];
            (order.items as any[]).forEach((it: any) => {
              const k = it.addedAt || "initial";
              if (!batches[k]) { batches[k] = []; keys.push(k); }
              batches[k].push(it);
            });
            return keys.map((batchKey, batchIdx) => (
              <div key={batchKey}>
                {batchIdx > 0 && (
                  <div className="my-2 flex items-center gap-2 text-[9px] text-amber-400 font-bold uppercase tracking-wider">
                    <div className="flex-1 border-t border-dashed border-amber-500/30" />
                    <span>+ {batchKey !== "initial" ? new Date(batchKey).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "agregado"}</span>
                    <div className="flex-1 border-t border-dashed border-amber-500/30" />
                  </div>
                )}
                {batches[batchKey].map((item: any, i: number) => {
                  const hasOverride = item.priceOverride !== undefined && item.priceOverride !== null;
                  const unitPrice = hasOverride ? item.priceOverride : (item.unitPrice ?? 0);
                  const total = item.total ?? (unitPrice * item.quantity);
                  return (
                    <div key={`${batchKey}-${i}`} className="flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="text-white">
                          <span className="font-semibold">{item.quantity}×</span> {item.name}
                        </div>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-[11px] text-slate-500 pl-5">
                            {item.selectedOptions.map((so: any) => `${so.group}: ${so.choices.map((c: any) => c.name).join(", ")}`).join(" / ")}
                          </div>
                        )}
                        {hasOverride && item.overrideNote && (
                          <div className="text-[10px] text-amber-300 pl-5">Nota: {item.overrideNote}</div>
                        )}
                      </div>
                      <span className="text-slate-300 shrink-0">${total.toLocaleString("es-AR")}</span>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
          <div className="flex justify-between pt-2 border-t border-white/5 mt-2 text-base font-bold text-white">
            <span>Total</span>
            <span>${order.total.toLocaleString("es-AR")}</span>
          </div>
        </div>

        {/* Customer */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Cliente</div>
          <div className="text-sm font-semibold text-white">{order.customerName}</div>
          <div className="text-xs text-slate-400">{order.customerPhone}</div>
          {order.customerAddress && <div className="text-xs text-slate-400">{order.customerAddress}</div>}
          {order.notes && (
            <div className="mt-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[11px] text-amber-200">
              📝 {order.notes}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-3 py-1.5 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
              >
                WhatsApp
              </a>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/25 transition-colors"
              >
                Maps
              </a>
            )}
          </div>
        </div>

          {/* Payment + ticket actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={async () => {
                const next = order.paymentStatus === "PAID" ? "UNPAID" : "PAID";
                await fetch(`/api/orders/${order.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ paymentStatus: next }),
                });
                window.location.reload();
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                order.paymentStatus === "PAID"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                  : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
              }`}
            >
              {order.paymentStatus === "PAID" ? "✓ Pagado · marcar sin pagar" : "🔴 Sin pagar · marcar pagado"}
            </button>
            <a
              href={`/restaurante/order/${order.id}/ticket`}
              target="_blank"
              rel="noopener"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 text-center hover:bg-white/10 transition-colors"
            >
              🖨️ Imprimir comanda
            </a>
          </div>

          {/* Status actions */}
          <div className="mt-3 flex gap-2">
            {config.next && config.nextLabel && (
              <button
                onClick={() => onUpdateStatus(order.id, config.next!)}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                {config.nextLabel}
              </button>
            )}
            {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
              <button
                onClick={() => onUpdateStatus(order.id, "CANCELLED")}
                className="rounded-xl border border-red-500/20 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
    </div>
  );
}

function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
