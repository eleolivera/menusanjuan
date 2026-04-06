"use client";

import { useState } from "react";
import { formatARS } from "@/lib/admin-utils";
import { NumberPad } from "./NumberPad";

const QUICK_CASH = [1000, 2000, 5000, 10000, 20000];

type Method = "cash" | "card" | "transfer" | "mercadopago";

const METHODS: { value: Method; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
];

export function PosPaymentSheet({
  total,
  onPay,
  onClose,
  submitting,
}: {
  total: number;
  onPay: (method: string, cashTendered?: number) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState<string>("");

  // Clamp to non-negative integer pesos (no cents in ARS)
  const tenderedNum = Math.max(0, Math.floor(parseInt(tendered, 10) || 0));
  const change = tenderedNum - total;
  // Cash requires tendered >= total (or total = 0)
  const canPay = method !== "cash" || total === 0 || tenderedNum >= total;

  function handlePay() {
    if (submitting || !canPay) return;
    onPay(method, method === "cash" ? tenderedNum : undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
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
            <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl px-2">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3" style={{ minHeight: 0 }}>
          {/* Payment method picker */}
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMethod(m.value); if (m.value !== "cash") setTendered(""); }}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  method === m.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Cash calculator */}
          {method === "cash" && (
            <div className="space-y-3 animate-fade-in">
              {/* Display */}
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Recibido</span>
                <span className="text-2xl font-bold text-white">
                  {tenderedNum > 0 ? formatARS(tenderedNum) : "$0"}
                </span>
              </div>

              {/* Quick buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setTendered(String(total))} className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                  Exacto
                </button>
                {QUICK_CASH.filter((v) => v >= total).slice(0, 5).map((v) => (
                  <button key={v} onClick={() => setTendered(String(v))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-300 hover:bg-white/10 transition-colors">
                    {formatARS(v)}
                  </button>
                ))}
              </div>

              {/* On-screen number pad — no native keyboard */}
              <NumberPad value={tendered} onChange={setTendered} maxLength={7} />

              {/* Change display */}
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

          {method === "card" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-xs text-slate-400">Cobrar con tu Posnet o terminal</p>
              <p className="text-[10px] text-slate-600 mt-1">Tocar "Confirmar" cuando este cobrado</p>
            </div>
          )}

          {method === "transfer" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-xs text-slate-400">Confirmar que el cliente hizo la transferencia</p>
            </div>
          )}

          {method === "mercadopago" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-xs text-slate-400">Cobrar con tu QR de Mercado Pago</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/5 p-3">
          <button
            onClick={handlePay}
            disabled={!canPay || submitting}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
          >
            {submitting ? "Procesando..." : "Confirmar y enviar a cocina"}
          </button>
        </div>
      </div>
    </div>
  );
}
