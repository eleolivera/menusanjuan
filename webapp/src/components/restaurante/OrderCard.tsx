"use client";

import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { PaymentCollector, type CollectedPayment } from "@/components/PaymentCollector";
import { MoneyInput } from "@/components/MoneyInput";
import { buildDeliveryInstructions } from "@/lib/delivery-instructions";

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
    nextLabel: "👨‍🍳 Mandar a Cocina",
  },
  PAID: {
    // Legacy status — pre-existing orders may still be here. Treat like GENERATED for new transitions.
    label: "Pagado",
    emoji: "💰",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    next: "PROCESSING",
    nextLabel: "👨‍🍳 Mandar a Cocina",
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
  // "charge"  = full PaymentCollector with cash calculator (cobrar ahora, in-person)
  // "record"  = compact PaymentCollector (registra pago externo, sin calculadora)
  const [paymentSheet, setPaymentSheet] = useState<null | "charge" | "record">(null);
  const [unmarking, setUnmarking] = useState(false);
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState<number | null>(null);
  const [savingFee, setSavingFee] = useState(false);
  const [showKitchenPrompt, setShowKitchenPrompt] = useState(false);
  const [printing, setPrinting] = useState(false);

  /**
   * Print via hidden iframe — no intermediate tab. The iframe loads the ticket
   * page with ?autoprint=1, TicketView triggers window.print() against its own
   * document, the OS print dialog comes up directly. After print closes
   * (afterprint event), we show the "send to kitchen" prompt if applicable.
   */
  function handlePrint() {
    if (printing) return;
    setPrinting(true);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
    iframe.src = `/restaurante/order/${order.id}/ticket?autoprint=1`;

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
      setPrinting(false);
    }

    iframe.onload = () => {
      try {
        const cw = iframe.contentWindow;
        cw?.addEventListener("afterprint", () => {
          // Nudge to advance status for orders that haven't reached the kitchen yet
          if (order.status === "GENERATED" || order.status === "PAID") {
            setShowKitchenPrompt(true);
          }
          setTimeout(cleanup, 500);
        });
      } catch {
        // Cross-frame access blocked? unlikely (same-origin), just cleanup later.
      }
      // Safety net — if afterprint never fires (some browsers/contexts), cleanup
      // after 30s so the iframe doesn't pile up.
      setTimeout(cleanup, 30000);
    };

    document.body.appendChild(iframe);
  }

  function confirmKitchen() {
    onUpdateStatus(order.id, "PROCESSING");
    setShowKitchenPrompt(false);
  }
  const config = STATUS_CONFIG[order.status];
  const totalDue = (order.total || 0) + (order.deliveryFee || 0);
  const paidWhen = order.paidAt ? new Date(order.paidAt) : null;
  const paidAgo = paidWhen ? getTimeSince(paidWhen.toISOString()) : null;
  const methodLabel = order.paymentMethod === "cash" ? "efectivo"
    : order.paymentMethod === "card" ? "tarjeta"
    : order.paymentMethod === "transfer" ? "transferencia"
    : order.paymentMethod === "mercadopago" ? "Mercado Pago"
    : null;

  async function collectPayment(data: CollectedPayment) {
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAID", ...data }),
    });
    setPaymentSheet(null);
    window.location.reload();
  }

  async function unmarkPaid() {
    setUnmarking(true);
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "UNPAID" }),
      });
      window.location.reload();
    } finally {
      setUnmarking(false);
    }
  }

  async function saveDeliveryFee() {
    if (feeDraft == null || feeDraft < 0) return;
    setSavingFee(true);
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryFee: feeDraft }),
      });
      setEditingFee(false);
      window.location.reload();
    } finally {
      setSavingFee(false);
    }
  }

  const needsDeliveryFee = order.deliveryMethod === "delivery" && (!order.deliveryFee || order.deliveryFee === 0);
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
              ${totalDue.toLocaleString("es-AR")}
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
          {/* Totals: show subtotal + envío breakdown when delivery has a fee, otherwise a single Total line */}
          {order.deliveryMethod === "delivery" && (order.deliveryFee || 0) > 0 ? (
            <div className="pt-2 border-t border-white/5 mt-2 space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>${order.total.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Envío</span>
                <span>${(order.deliveryFee || 0).toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-1 border-t border-white/5">
                <span>Total</span>
                <span>${totalDue.toLocaleString("es-AR")}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between pt-2 border-t border-white/5 mt-2 text-base font-bold text-white">
              <span>Total</span>
              <span>${order.total.toLocaleString("es-AR")}</span>
            </div>
          )}
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
          <div className="flex flex-wrap gap-2 pt-1">
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
            {order.deliveryMethod === "delivery" && (
              <CopyDeliveryButton order={order} restaurantName={restaurantName} variant="subtle" />
            )}
          </div>
        </div>

          {/* Delivery fee — three states: missing (warning + add), set (display + edit), editing (form) */}
          {order.deliveryMethod === "delivery" && !editingFee && needsDeliveryFee && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-amber-200">
                <span className="font-semibold">⚠️ Falta cargar el envío</span>
                <span className="block text-[10px] text-amber-300/70 mt-0.5">No vas a poder cobrar hasta que lo cargues</span>
              </span>
              <button
                onClick={() => { setEditingFee(true); setFeeDraft(null); }}
                className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors shrink-0"
              >
                + Cargar envío
              </button>
            </div>
          )}
          {order.deliveryMethod === "delivery" && !editingFee && !needsDeliveryFee && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                <span className="text-slate-500">Envío:</span>{" "}
                <span className="font-semibold text-white">${(order.deliveryFee || 0).toLocaleString("es-AR")}</span>
              </span>
              <button
                onClick={() => { setEditingFee(true); setFeeDraft(order.deliveryFee || null); }}
                className="text-[11px] text-slate-400 hover:text-primary transition-colors"
              >
                Editar
              </button>
            </div>
          )}
          {editingFee && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 space-y-2">
              <div className="text-[11px] font-semibold text-amber-200">
                {needsDeliveryFee ? "¿Cuánto le cobrás de envío?" : "Editar envío"}
              </div>
              <MoneyInput
                value={feeDraft}
                onChange={setFeeDraft}
                placeholder="2500"
                darkMode
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingFee(false); setFeeDraft(null); }}
                  disabled={savingFee}
                  className="flex-1 rounded-lg border border-white/10 py-1.5 text-[11px] text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveDeliveryFee}
                  disabled={savingFee || feeDraft == null || feeDraft < 0}
                  className="flex-1 rounded-lg bg-amber-500 py-1.5 text-[11px] font-bold text-slate-900 hover:bg-amber-400 transition-colors disabled:opacity-30"
                >
                  {savingFee ? "..." : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {/* Payment status pill */}
          {order.paymentStatus === "PAID" ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center justify-between text-xs">
              <div className="text-emerald-300">
                <span className="font-semibold">✓ Pagado</span>
                {methodLabel && <span className="text-emerald-400/70"> · {methodLabel}</span>}
                {paidAgo && <span className="text-emerald-400/70"> · {paidAgo}</span>}
              </div>
              <button
                onClick={unmarkPaid}
                disabled={unmarking}
                className="text-[10px] text-emerald-400/60 hover:text-emerald-300 underline transition-colors disabled:opacity-50"
              >
                {unmarking ? "..." : "desmarcar"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center text-xs">
              <span className="text-red-300 font-semibold">🔴 Sin pagar</span>
            </div>
          )}

          {/* Action buttons */}
          {order.paymentStatus === "UNPAID" ? (
            <>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => setPaymentSheet("charge")}
                  disabled={needsDeliveryFee}
                  className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-primary/20 hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  💰 Cobrar ${totalDue.toLocaleString("es-AR")}
                </button>
                <button
                  onClick={() => setPaymentSheet("record")}
                  disabled={needsDeliveryFee}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ✓ Ya pagó (transfer / MP)
                </button>
              </div>
              {needsDeliveryFee && (
                <p className="mt-1.5 text-[10px] text-amber-300 text-center">
                  ↑ Cargá el envío primero para poder cobrar
                </p>
              )}
            </>
          ) : null}

          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="block w-full mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-slate-300 text-center hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {printing ? "🖨️ Imprimiendo..." : "🖨️ Imprimir comanda"}
          </button>

          {paymentSheet && (
            <PaymentCollector
              total={totalDue}
              onCollect={collectPayment}
              onCancel={() => setPaymentSheet(null)}
              title={paymentSheet === "charge" ? `Cobrar pedido ${order.orderNumber}` : `Registrar pago · ${order.orderNumber}`}
              confirmLabel={paymentSheet === "charge" ? "Cobrado" : "Registrar"}
              compact={paymentSheet === "record"}
            />
          )}

          {/* Status actions */}
          <div className="mt-3 flex gap-2">
            {config.next && config.nextLabel && (
              <button
                onClick={() => onUpdateStatus(order.id, config.next!)}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all ring-1 ring-white/10"
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

        {/* Post-print kitchen prompt — only for orders not yet in the kitchen */}
        {showKitchenPrompt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowKitchenPrompt(false)}
          >
            <div
              className="rounded-2xl bg-slate-900 border border-white/10 p-6 max-w-sm w-full space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-5xl mb-2">👨‍🍳</div>
                <h3 className="text-lg font-bold text-white">¿Mandar a la cocina?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Imprimiste la comanda <span className="font-mono text-slate-300">{order.orderNumber}</span>. Te recordamos avanzar el pedido a "En cocina" para que aparezca en el siguiente paso del Kanban.
                </p>
              </div>
              {order.deliveryMethod === "delivery" && (
                <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-3 space-y-2">
                  <div className="text-[11px] text-indigo-200">
                    💡 Si lo mandás por <strong>delivery</strong>, copiá las instrucciones para pegarlas en el grupo del repartidor.
                  </div>
                  <CopyDeliveryButton order={order} restaurantName={restaurantName} variant="primary" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowKitchenPrompt(false)}
                  className="rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Ahora no
                </button>
                <button
                  type="button"
                  onClick={confirmKitchen}
                  className="rounded-xl bg-gradient-to-r from-primary to-amber-500 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all"
                >
                  ✓ Sí, mandar
                </button>
              </div>
            </div>
          </div>
        )}
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

/**
 * Button that copies a paste-ready delivery instructions block to the
 * clipboard for forwarding to the resta's WhatsApp delivery group. Used in
 * two places — the Cliente block (subtle indigo) and the kitchen-prompt
 * modal (emerald, more prominent).
 */
function CopyDeliveryButton({
  order,
  restaurantName,
  variant = "subtle",
}: {
  order: Order;
  restaurantName: string;
  variant?: "subtle" | "primary";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = buildDeliveryInstructions(order, restaurantName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Older browsers / blocked clipboard — fall back to prompt() so the
      // text is still recoverable
      window.prompt("Copiá este texto y pegalo en el grupo de WhatsApp:", text);
    }
  }

  const subtleClass = "flex items-center gap-1.5 rounded-lg bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/25 transition-colors";
  const primaryClass = "w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-4 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-400/15 transition-colors";

  return (
    <button
      type="button"
      onClick={copy}
      className={variant === "primary" ? primaryClass : subtleClass}
      title="Copiar al portapapeles para pegar en WhatsApp"
    >
      {copied ? "✓ Copiado al portapapeles" : "📋 Instrucciones para delivery"}
    </button>
  );
}
