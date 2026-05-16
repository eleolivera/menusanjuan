"use client";

import { useState } from "react";
import { formatARS } from "@/lib/admin-utils";
import { PaymentCollector, type CollectedPayment } from "@/components/PaymentCollector";

export function PosPaymentSheet({
  total,
  onPay,
  onPayLater,
  onClose,
  submitting,
  allowPayLater = false,
  confirmLabel = "Confirmar y enviar a cocina",
  payLaterLabel = "Enviar a cocina (cobrar después)",
}: {
  total: number;
  onPay: (method: string, cashTendered?: number) => void;
  onPayLater?: () => void;
  onClose: () => void;
  submitting: boolean;
  allowPayLater?: boolean;
  /** Confirm button label — caller passes context-appropriate copy. */
  confirmLabel?: string;
  /** Pay-later button label (only shown when allowPayLater is true). */
  payLaterLabel?: string;
}) {
  const [payLater, setPayLater] = useState(false);

  function handleCollect(data: CollectedPayment) {
    onPay(data.paymentMethod, data.cashTendered);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[95vh] bg-slate-950 rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with total */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total a cobrar</p>
              <p className="text-3xl font-extrabold text-white">{formatARS(total)}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl px-2" disabled={submitting}>×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3" style={{ minHeight: 0 }}>
          {/* Pay-later toggle (mostrador only) */}
          {allowPayLater && (
            <label className={`flex items-center justify-between rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
              payLater ? "border-amber-500/40 bg-amber-500/10" : "border-white/10 bg-white/5 hover:border-white/20"
            }`}>
              <div>
                <div className={`text-sm font-medium ${payLater ? "text-amber-300" : "text-white"}`}>
                  Cobrar después
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  El pedido sale a cocina sin marcarse pagado.
                </div>
              </div>
              <input
                type="checkbox"
                checked={payLater}
                onChange={(e) => setPayLater(e.target.checked)}
                className="h-5 w-9 appearance-none rounded-full bg-slate-700 transition-colors checked:bg-amber-500 relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
              />
            </label>
          )}

          {payLater ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
              <p className="text-sm text-amber-200 font-medium">El pedido va a cocina sin pago.</p>
              <p className="text-[11px] text-amber-300/70 mt-1.5">
                Vas a poder marcarlo pagado desde el tablero de pedidos.
              </p>
            </div>
          ) : (
            <PaymentCollector
              total={total}
              onCollect={handleCollect}
              onCancel={onClose}
              layout="inline"
              submitting={submitting}
              confirmLabel={confirmLabel}
            />
          )}
        </div>

        {/* Footer — only when in pay-later mode (otherwise PaymentCollector inline renders its own button) */}
        {payLater && (
          <div className="shrink-0 border-t border-white/5 p-3">
            <button
              onClick={() => onPayLater?.()}
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
            >
              {submitting ? "Procesando..." : payLaterLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
