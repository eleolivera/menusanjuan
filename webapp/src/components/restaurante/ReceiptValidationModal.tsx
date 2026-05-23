"use client";

import { useState } from "react";
import type { Order } from "@/lib/orders-store";

/**
 * Cashier-side modal — opens whenever the order has a `paymentReceiptUrl` on
 * file, regardless of `paymentStatus`. The footer adapts to the current state:
 *   - PAID_UNVERIFIED → [✗ Rechazar] + [✓ Validar pago] (the original CTA flow)
 *   - PAID            → header shows "Pagado · validado hace X" + a single
 *                       [Marcar sin pagar] button for the "validé por error" case
 *                       (does NOT clear the receipt so it stays viewable for audit)
 *   - UNPAID          → header "Comprobante anterior" + single [Cerrar] button
 *                       (data-state shouldn't happen normally since Rechazar
 *                       clears the URL, but we handle it for SQL-level edge cases)
 */
export function ReceiptValidationModal({
  order,
  onClose,
  onDone,
}: {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<"validate" | "reject" | "unmark" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = order.total || 0;
  const fee = order.deliveryFee || 0;
  const total = subtotal + fee;
  const intentLabel =
    order.paymentIntent === "transfer" ? "Transferencia"
    : order.paymentIntent === "mercadopago" ? "Mercado Pago"
    : order.paymentIntent === "cash" ? "Efectivo"
    : "—";

  const uploadedAt = order.paymentReceiptAt
    ? new Date(order.paymentReceiptAt)
    : null;
  const ago = uploadedAt ? getTimeAgo(uploadedAt) : null;
  const paidAtDate = order.paidAt ? new Date(order.paidAt) : null;
  const paidAgo = paidAtDate ? getTimeAgo(paidAtDate) : null;

  const isPending = order.paymentStatus === "PAID_UNVERIFIED";
  const isPaid = order.paymentStatus === "PAID";

  // Mark an already-validated payment as unpaid WITHOUT clearing the receipt URL.
  // Cashier flow: they hit "Validar" by mistake; this is the undo. Receipt stays
  // viewable so the modal keeps working for further audit.
  async function unmarkPaid() {
    if (!confirm("¿Marcar este pedido como sin pagar? El comprobante se mantiene para que lo puedas seguir viendo.")) return;
    setBusy("unmark");
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Intentionally NO clearReceipt — we want the image to remain available.
        body: JSON.stringify({ paymentStatus: "UNPAID" }),
      });
      if (!res.ok) throw new Error("Error al cambiar el estado");
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function validate() {
    setBusy("validate");
    setError(null);
    try {
      const body: any = {
        paymentStatus: "PAID",
      };
      // Lock in the intent as the method when validating; cashier can still
      // override via paymentMethod field if needed (we don't expose that UI here).
      if (order.paymentIntent) body.paymentMethod = order.paymentIntent;
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al validar");
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function reject() {
    if (!confirm("¿Rechazar el comprobante? El cliente va a poder subir otro.")) return;
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "UNPAID",
          clearReceipt: true,
        }),
      });
      if (!res.ok) throw new Error("Error al rechazar");
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl bg-slate-900 border border-white/10 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — title + sub-line change based on state so the modal is
           clearly self-describing whether you're validating, auditing, or
           looking at a rejected old receipt. */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-white">
              {isPending ? "Validar comprobante" : isPaid ? "Comprobante validado" : "Comprobante anterior"}
            </h2>
            <p className="text-[11px] text-slate-400">
              Pedido {order.orderNumber}
              {isPaid && paidAgo && <span className="text-emerald-400/70"> · ✓ pagado hace {paidAgo}</span>}
              {!isPending && !isPaid && <span className="text-red-300/70"> · sin pagar</span>}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Receipt image */}
          {order.paymentReceiptUrl ? (
            <a
              href={order.paymentReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-white/10 bg-black/30 overflow-hidden"
              title="Abrir imagen en tamaño completo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.paymentReceiptUrl}
                alt="Comprobante"
                className="w-full max-h-[60vh] object-contain"
              />
            </a>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
              No hay imagen de comprobante guardada.
            </div>
          )}

          {/* Totals side-by-side */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Subtotal</div>
              <div className="text-sm font-bold text-white mt-0.5">${subtotal.toLocaleString("es-AR")}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Envío</div>
              <div className="text-sm font-bold text-white mt-0.5">${fee.toLocaleString("es-AR")}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/70">Total</div>
              <div className="text-sm font-extrabold text-emerald-300 mt-0.5">${total.toLocaleString("es-AR")}</div>
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente dijo que iba a pagar por</span>
              <span className="font-semibold text-white">{intentLabel}</span>
            </div>
            {ago && (
              <div className="flex justify-between">
                <span className="text-slate-500">Subido</span>
                <span className="text-slate-300">hace {ago}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente</span>
              <span className="text-slate-300">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Teléfono</span>
              <span className="text-slate-300">{order.customerPhone}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              ⚠️ {error}
            </div>
          )}

          {/* Actions — branch by state */}
          {isPending ? (
            <>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={reject}
                  disabled={busy !== null}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {busy === "reject" ? "..." : "✗ Rechazar"}
                </button>
                <button
                  type="button"
                  onClick={validate}
                  disabled={busy !== null}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/30 hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {busy === "validate" ? "..." : `✓ Validar pago ${"$" + total.toLocaleString("es-AR")}`}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                Rechazar limpia el comprobante y el cliente puede subir otro. Validar lo marca como pagado y bloquea cambios.
              </p>
            </>
          ) : isPaid ? (
            <>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={unmarkPaid}
                  disabled={busy !== null}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {busy === "unmark" ? "..." : "Marcar sin pagar"}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                Si validaste por error podés marcarlo como sin pagar. El comprobante se mantiene para que lo puedas seguir consultando.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
              >
                Cerrar
              </button>
              <p className="text-[10px] text-slate-500 text-center">
                Este comprobante está guardado para consulta. Si el cliente subió otro nuevo, lo vas a ver en el pedido actual.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "menos de 1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
