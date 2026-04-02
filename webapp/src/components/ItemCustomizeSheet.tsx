"use client";

import { useState } from "react";
import type { MenuItemData, OptionGroupData } from "@/data/menus";

export type SelectedOptions = {
  group: string;
  groupId: string;
  choices: { name: string; priceDelta: number }[];
  delta: number;
}[];

type Props = {
  item: MenuItemData;
  onAdd: (quantity: number, selectedOptions: SelectedOptions, optionsDelta: number) => void;
  onClose: () => void;
};

export function ItemCustomizeSheet({ item, onAdd, onClose }: Props) {
  const groups = item.optionGroups || [];
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    groups.forEach((g) => { init[g.id] = new Set(); });
    return init;
  });
  const [quantity, setQuantity] = useState(1);

  function toggleOption(groupId: string, optionName: string, group: OptionGroupData) {
    setSelections((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[groupId]);

      if (group.maxSelections === 1) {
        // Single-select (radio)
        set.clear();
        set.add(optionName);
      } else {
        // Multi-select (checkbox)
        if (set.has(optionName)) {
          set.delete(optionName);
        } else if (set.size < group.maxSelections) {
          set.add(optionName);
        }
      }

      copy[groupId] = set;
      return copy;
    });
  }

  // Check if all required groups are satisfied
  const allRequiredMet = groups.every((g) => {
    if (g.minSelections === 0) return true;
    return (selections[g.id]?.size || 0) >= g.minSelections;
  });

  // Calculate total delta
  let optionsDelta = 0;
  groups.forEach((g) => {
    g.options.forEach((o) => {
      if (selections[g.id]?.has(o.name)) {
        optionsDelta += o.priceDelta;
      }
    });
  });

  const totalPrice = (item.price + optionsDelta) * quantity;

  function handleAdd() {
    const selectedOptions: SelectedOptions = groups
      .filter((g) => (selections[g.id]?.size || 0) > 0)
      .map((g) => {
        const chosen = g.options.filter((o) => selections[g.id]?.has(o.name));
        return {
          group: g.title,
          groupId: g.id,
          choices: chosen.map((o) => ({ name: o.name, priceDelta: o.priceDelta })),
          delta: chosen.reduce((s, o) => s + o.priceDelta, 0),
        };
      });
    onAdd(quantity, selectedOptions, optionsDelta);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with item image */}
        {item.imageUrl && (
          <div className="relative h-40 bg-slate-100 shrink-0">
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70 transition-colors">
              x
            </button>
          </div>
        )}

        {/* Item info */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          {!item.imageUrl && (
            <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-text text-lg">x</button>
          )}
          <h2 className="text-lg font-bold text-text">{item.name}</h2>
          {item.description && <p className="text-sm text-text-secondary mt-0.5">{item.description}</p>}
          <p className="text-base font-bold text-primary mt-1">${item.price.toLocaleString("es-AR")}</p>
        </div>

        {/* Option groups */}
        <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ minHeight: 0 }}>
          {groups.map((g) => {
            const selected = selections[g.id] || new Set();
            const isRequired = g.minSelections > 0;

            return (
              <div key={g.id} className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold text-text">{g.title}</h3>
                  {isRequired && (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      Obligatorio
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted ml-auto">
                    {selected.size}/{g.maxSelections}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {g.options.filter((o) => o.available).map((o) => {
                    const isSelected = selected.has(o.name);
                    const isRadio = g.maxSelections === 1;
                    const atMax = !isRadio && selected.size >= g.maxSelections && !isSelected;

                    return (
                      <button
                        key={o.id}
                        onClick={() => !atMax && toggleOption(g.id, o.name, g)}
                        disabled={atMax}
                        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : atMax
                              ? "border-border/30 bg-slate-50 opacity-50"
                              : "border-border/60 hover:border-primary/40"
                        }`}
                      >
                        {/* Radio / Checkbox indicator */}
                        <div className={`h-5 w-5 rounded-${isRadio ? "full" : "md"} border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>

                        <span className={`text-sm flex-1 ${isSelected ? "font-semibold text-text" : "text-text-secondary"}`}>
                          {o.name}
                        </span>

                        {o.priceDelta > 0 && (
                          <span className="text-xs text-text-muted shrink-0">+${o.priceDelta.toLocaleString("es-AR")}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: quantity + add button */}
        <div className="shrink-0 border-t border-border/50 bg-white px-5 py-4 space-y-3">
          {/* Quantity */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              -
            </button>
            <span className="text-lg font-bold text-text w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              +
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!allRequiredMet}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:shadow-md flex items-center justify-between"
          >
            <span>{allRequiredMet ? "Agregar al pedido" : "Completa las opciones"}</span>
            <span>${totalPrice.toLocaleString("es-AR")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
