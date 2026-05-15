"use client";

import { useState } from "react";
import { formatARS } from "@/lib/admin-utils";
import { NumberPad } from "@/components/restaurante/pos/NumberPad";

export type PaymentMethod = "cash" | "card" | "transfer" | "mercadopago";

export type CollectedPayment = {
  paymentMethod: PaymentMethod;
  cashTendered?: number;
  cashChange?: number;
};

const METHODS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: "cash", label: "Efectivo", emoji: "💵" },
  { value: "card", label: "Tarjeta", emoji: "💳" },
  { value: "transfer", label: "Transferencia", emoji: "🏦" },
  { value: "mercadopago", label: "Mercado Pago", emoji: "📲" },
];

const QUICK_CASH = [1000, 2000, 5000, 10000, 20000];

/**
 * Shared payment collection UI — method picker + cash calculator.
 * Used by:
 *  - OrderCard (kanban) "Cobrar" button → opens modal
 *  - Driver page mark-delivered flow → opens modal
 *  - PosPaymentSheet (POS counter/mesa) → renders inline
 */
export function PaymentCollector({
  total,
  onCollect,
  onCancel,
  layout = "modal",
  submitting = false,
  confirmLabel = "Cobrado",
  title = "Cobrar pedido",
  compact = false,
}: {
  total: number;
  onCollect: (data: CollectedPayment) => void | Promise<void>;
  onCancel: () => void;
  layout?: "modal" | "inline";
  submitting?: boolean;
  confirmLabel?: string;
  title?: string;
  /**
   * Compact mode: just pick a payment method and confirm — no cash calculator,
   * no "recibido" / "vuelto". Used for "Ya pagó" flows where the customer already
   * paid externally (e.g. sent a transfer screenshot) and the owner just needs to
   * record HOW.
   */
  compact?: boolean;
}) {
  const [method, setMethod] = useState<PaymentMethod>(compact ? "transfer" : "cash");
  const [tendered, setTendered] = useState<string>("");

  const tenderedNum = Math.max(0, Math.floor(parseInt(tendered, 10) || 0));
  const change = tenderedNum - total;
  const showCash = method === "cash" && !compact;
  const canConfirm = compact || method !== "cash" || total === 0 || tenderedNum >= total;

  function handleConfirm() {
    if (!canConfirm || submitting) return;
    if (method === "cash" && !compact) {
      onCollect({
        paymentMethod: "cash",
        cashTendered: tenderedNum,
        cashChange: Math.max(0, change),
      });
    } else {
      onCollect({ paymentMethod: method });
    }
  }

  const body = (
    <div className="space-y-3">
      {/* Total to collect */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider">{layout === "modal" ? "A cobrar" : "Total a cobrar"}</span>
        <span className="text-2xl font-extrabold text-white">{formatARS(total)}</span>
      </div>

      {/* Method picker */}
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMethod(m.value);
              if (m.value !== "cash") setTendered("");
            }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              method === m.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
            }`}
          >
            <span className="text-base">{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Cash calculator — hidden in compact mode */}
      {showCash && (
        <div className="space-y-3 animate-fade-in">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Recibido</span>
            <span className="text-2xl font-bold text-white">
              {tenderedNum > 0 ? formatARS(tenderedNum) : "$0"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTendered(String(total))}
              className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Exacto
            </button>
            {QUICK_CASH.filter((v) => v >= total).slice(0, 5).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTendered(String(v))}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-300 hover:bg-white/10 transition-colors"
              >
                {formatARS(v)}
              </button>
            ))}
          </div>

          <NumberPad value={tendered} onChange={setTendered} maxLength={7} />

          {tenderedNum > 0 && (
            <div className={`rounded-xl border p-3 text-center ${change >= 0 ? "border-emerald-400/30 bg-emerald-400/10" : "border-red-400/30 bg-red-400/10"}`}>
              <p className={`text-[10px] uppercase tracking-wider mb-0.5 ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {change >= 0 ? "Vuelto" : "Falta"}
              </p>
              <p className={`text-3xl font-extrabold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatARS(Math.abs(change))}
              </p>
            </div>
          )}
        </div>
      )}

      {method === "cash" && compact && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-slate-400">El cliente pagó en efectivo</p>
        </div>
      )}

      {method === "card" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          {compact ? (
            <p className="text-xs text-slate-400">El cliente pagó con tarjeta</p>
          ) : (
            <>
              <p className="text-xs text-slate-400">Cobrar con tu Posnet o terminal</p>
              <p className="text-[10px] text-slate-600 mt-1">Tocá "{confirmLabel}" cuando esté cobrado</p>
            </>
          )}
        </div>
      )}

      {method === "transfer" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-slate-400">
            {compact ? "El cliente envió el comprobante de transferencia" : "Confirmá que el cliente hizo la transferencia"}
          </p>
        </div>
      )}

      {method === "mercadopago" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-slate-400">
            {compact ? "El cliente pagó por Mercado Pago" : "Cobrar con tu QR de Mercado Pago"}
          </p>
        </div>
      )}
    </div>
  );

  if (layout === "inline") {
    return (
      <div className="space-y-3">
        {body}
        {/* Inline mode: parent supplies its own footer/buttons (e.g. PosPaymentSheet sticky bottom).
            We expose a single confirm button here as well, so it's self-sufficient. */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || submitting}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
        >
          {submitting ? "Procesando..." : confirmLabel}
        </button>
      </div>
    );
  }

  // Modal layout
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-md max-h-[95vh] bg-slate-950 rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-white text-2xl px-2" disabled={submitting}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3" style={{ minHeight: 0 }}>
          {body}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/5 p-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
          >
            {submitting ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
