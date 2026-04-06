"use client";

import { useState } from "react";
import type { PosCartLine } from "./PosBoard";
import { formatARS } from "@/lib/admin-utils";

export function PosPriceOverrideSheet({
  line,
  onConfirm,
  onClose,
}: {
  line: PosCartLine;
  onConfirm: (price: number, note: string) => void;
  onClose: () => void;
}) {
  const originalPrice = line.item.price + line.optionsDelta;
  const [price, setPrice] = useState<string>(line.priceOverride !== undefined ? String(line.priceOverride) : String(originalPrice));
  const [note, setNote] = useState(line.overrideNote || "");

  const newPrice = parseFloat(price) || 0;
  const canConfirm = note.trim().length > 0 && newPrice >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-slate-950 rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Modificar precio</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-lg">x</button>
          </div>
          <p className="text-xs text-slate-500 mt-1 truncate">{line.item.name}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Original price */}
          <div className="rounded-xl bg-white/5 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Precio original</span>
            <span className="text-sm text-slate-400 line-through">{formatARS(originalPrice)}</span>
          </div>

          {/* New price */}
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Nuevo precio (puede ser $0 = gratis)</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-2xl font-bold text-white text-right placeholder:text-slate-700 focus:border-primary focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setPrice("0")} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-400/20">
                Gratis ($0)
              </button>
              <button onClick={() => setPrice(String(originalPrice))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:bg-white/10">
                Restaurar
              </button>
            </div>
          </div>

          {/* Note (required) */}
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Motivo (obligatorio)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Cortesia de la casa, Cliente VIP, Promo..."
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="border-t border-white/5 p-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-slate-400 hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(newPrice, note.trim())}
            disabled={!canConfirm}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-30 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
