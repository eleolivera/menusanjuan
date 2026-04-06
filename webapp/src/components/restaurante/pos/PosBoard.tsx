"use client";

import { useState, useEffect, useMemo } from "react";
import type { MenuCategoryData, MenuItemData } from "@/data/menus";
import { ItemCustomizeSheet, type SelectedOptions } from "@/components/ItemCustomizeSheet";
import { PosPaymentSheet } from "./PosPaymentSheet";
import { PosPriceOverrideSheet } from "./PosPriceOverrideSheet";
import { formatARS, normalize } from "@/lib/admin-utils";

let cartCounter = 0;

export type PosCartLine = {
  cartKey: string;
  item: MenuItemData;
  quantity: number;
  selectedOptions: SelectedOptions;
  optionsDelta: number;
  priceOverride?: number;
  overrideNote?: string;
};

type Mode = "DINE_IN" | "COUNTER";

export function PosBoard({
  slug,
  restaurantName,
  tableSuggestions,
  onSuggestionsUpdate,
}: {
  slug: string;
  restaurantName: string;
  tableSuggestions: string[];
  onSuggestionsUpdate: (s: string[]) => void;
}) {
  const [categories, setCategories] = useState<MenuCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [customizing, setCustomizing] = useState<MenuItemData | null>(null);
  const [overriding, setOverriding] = useState<PosCartLine | null>(null);
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("COUNTER");
  const [tableNumber, setTableNumber] = useState("");
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load menu
  useEffect(() => {
    fetch("/api/restaurante/menu")
      .then((r) => r.json())
      .then((cats: any[]) => {
        const mapped: MenuCategoryData[] = cats.map((c: any) => ({
          id: c.id, name: c.name, emoji: c.emoji || "🍽️",
          items: c.items.map((i: any) => ({
            id: i.id, name: i.name, description: i.description || "", price: i.price,
            imageUrl: i.imageUrl || "", badge: i.badge || undefined, available: i.available,
            optionGroups: (i.optionGroups || []).map((g: any) => ({
              id: g.id, title: g.title, minSelections: g.minSelections, maxSelections: g.maxSelections,
              options: g.options.map((o: any) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available })),
            })),
          })),
        }));
        setCategories(mapped);
        if (mapped.length > 0) setActiveCat(mapped[0].id);
        setLoading(false);
      });
  }, []);

  // Filter items by search
  const visibleItems = useMemo(() => {
    if (search.trim()) {
      const q = normalize(search);
      return categories.flatMap((c) => c.items.filter((i) => i.available && normalize(i.name).includes(q)));
    }
    const cat = categories.find((c) => c.id === activeCat);
    return cat ? cat.items.filter((i) => i.available) : [];
  }, [categories, activeCat, search]);

  // Cart calculations
  const total = cart.reduce((s, line) => {
    const linePrice = line.priceOverride !== undefined ? line.priceOverride : (line.item.price + line.optionsDelta);
    return s + linePrice * line.quantity;
  }, 0);
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  // ─── Cart actions ───

  function handleAddItem(item: MenuItemData) {
    if (item.optionGroups && item.optionGroups.length > 0) {
      setCustomizing(item);
    } else {
      setCart((prev) => {
        const existing = prev.find((l) => l.item.id === item.id && l.selectedOptions.length === 0 && l.priceOverride === undefined);
        if (existing) {
          return prev.map((l) => l.cartKey === existing.cartKey ? { ...l, quantity: l.quantity + 1 } : l);
        }
        return [...prev, { cartKey: `pos-${++cartCounter}`, item, quantity: 1, selectedOptions: [], optionsDelta: 0 }];
      });
    }
  }

  function addCustomized(item: MenuItemData, quantity: number, selectedOptions: SelectedOptions, optionsDelta: number) {
    setCart((prev) => {
      // Merge with existing line if item + options match exactly and no override
      const optionsKey = JSON.stringify(selectedOptions);
      const existing = prev.find((l) =>
        l.item.id === item.id &&
        l.priceOverride === undefined &&
        JSON.stringify(l.selectedOptions) === optionsKey
      );
      if (existing) {
        return prev.map((l) => l.cartKey === existing.cartKey ? { ...l, quantity: l.quantity + quantity } : l);
      }
      return [...prev, { cartKey: `pos-${++cartCounter}`, item, quantity, selectedOptions, optionsDelta }];
    });
    setCustomizing(null);
  }

  function changeQty(cartKey: string, delta: number) {
    setCart((prev) => {
      const line = prev.find((l) => l.cartKey === cartKey);
      if (!line) return prev;
      const newQty = line.quantity + delta;
      if (newQty <= 0) return prev.filter((l) => l.cartKey !== cartKey);
      return prev.map((l) => l.cartKey === cartKey ? { ...l, quantity: newQty } : l);
    });
  }

  function removeLine(cartKey: string) {
    setCart((prev) => prev.filter((l) => l.cartKey !== cartKey));
  }

  function applyPriceOverride(cartKey: string, price: number, note: string) {
    setCart((prev) => prev.map((l) => l.cartKey === cartKey ? { ...l, priceOverride: price, overrideNote: note } : l));
    setOverriding(null);
  }

  function clearOverride(cartKey: string) {
    setCart((prev) => prev.map((l) => l.cartKey === cartKey ? { ...l, priceOverride: undefined, overrideNote: undefined } : l));
  }

  // ─── Submit ───

  async function submitOrder(paymentMethod: string, cashTendered?: number) {
    if (submitting) return; // Prevent double-submit
    if (mode === "DINE_IN" && !tableNumber.trim()) {
      setErrorMsg("Falta numero de mesa");
      return;
    }
    if (cart.length === 0) return;

    setSubmitting(true);
    setErrorMsg(null);

    const items = cart.map((line) => {
      const linePrice = line.priceOverride !== undefined ? line.priceOverride : (line.item.price + line.optionsDelta);
      return {
        menuItemId: line.item.id,
        name: line.item.name,
        quantity: line.quantity,
        unitPrice: line.item.price,
        optionsDelta: line.optionsDelta,
        selectedOptions: line.selectedOptions,
        priceOverride: line.priceOverride,
        overrideNote: line.overrideNote,
        total: Math.round(linePrice * line.quantity),
      };
    });

    try {
      const res = await fetch("/api/restaurante/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          channel: mode,
          tableNumber: mode === "DINE_IN" ? tableNumber.trim() : null,
          paymentMethod,
          cashTendered,
          source: "pos-tablet",
        }),
      });

      if (res.ok) {
        const order = await res.json();
        setShowSuccess(order.orderNumber);
        setCart([]);
        setTableNumber("");
        setPaying(false);
        if (mode === "DINE_IN" && tableNumber.trim()) {
          const updated = [tableNumber.trim(), ...tableSuggestions.filter((t) => t !== tableNumber.trim())].slice(0, 30);
          onSuggestionsUpdate(updated);
        }
        setTimeout(() => setShowSuccess(null), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Error al crear pedido");
      }
    } catch {
      setErrorMsg("Error de conexion");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-white/5 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{restaurantName}</h1>
          <span className="text-[10px] text-slate-600">POS</span>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setMode("COUNTER")} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${mode === "COUNTER" ? "bg-primary text-white" : "bg-white/5 text-slate-400"}`}>
            Mostrador
          </button>
          <button onClick={() => setMode("DINE_IN")} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${mode === "DINE_IN" ? "bg-primary text-white" : "bg-white/5 text-slate-400"}`}>
            Mesa
          </button>
        </div>
      </div>

      {/* Mesa input */}
      {mode === "DINE_IN" && (
        <div className="shrink-0 border-b border-white/5 px-4 py-2 flex items-center gap-2">
          <label className="text-[10px] text-slate-500 shrink-0">Mesa:</label>
          <input
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="Mesa 5"
            list="table-suggestions"
            className="flex-1 max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
          />
          <datalist id="table-suggestions">
            {tableSuggestions.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
      )}

      {/* Body: menu + cart */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Menu side */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
          {/* Search */}
          <div className="shrink-0 px-3 py-2 border-b border-white/5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar item..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Category tabs */}
          {!search.trim() && categories.length > 0 && (
            <div className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-white/5">
              {categories.map((c) => (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${activeCat === c.id ? "bg-primary text-white" : "border border-white/10 text-slate-400 hover:bg-white/5"}`}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
            {visibleItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xs text-slate-600">Sin items disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className="rounded-xl border border-white/5 bg-slate-900/50 p-2.5 text-left hover:border-primary/30 hover:bg-slate-900 active:scale-95 transition-all"
                  >
                    {item.imageUrl && (
                      <div className="aspect-square w-full rounded-lg overflow-hidden mb-2 bg-white/5">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1">{item.name}</p>
                    <p className="text-xs font-bold text-primary">{formatARS(item.price)}</p>
                    {item.optionGroups && item.optionGroups.length > 0 && (
                      <p className="text-[9px] text-purple-400 mt-0.5">+ opciones</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart side — hidden on mobile, slide-over on tablet+ */}
        <div className={`${mobileCartOpen ? "fixed inset-0 z-40 bg-slate-950 flex" : "hidden"} md:relative md:flex md:w-80 md:shrink-0 flex-col bg-slate-900/30 md:inset-auto md:z-auto md:bg-slate-900/30`}>
          {mobileCartOpen && (
            <button onClick={() => setMobileCartOpen(false)} className="md:hidden absolute top-3 right-3 z-10 rounded-lg bg-white/10 p-2 text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          <div className="shrink-0 px-4 py-3 border-b border-white/5">
            <h2 className="text-xs font-bold text-white">Pedido</h2>
            <p className="text-[10px] text-slate-500">{itemCount} items</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ minHeight: 0 }}>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-8">Tocar items para agregar</p>
            ) : (
              cart.map((line) => {
                const linePrice = line.priceOverride !== undefined ? line.priceOverride : (line.item.price + line.optionsDelta);
                const isOverridden = line.priceOverride !== undefined;
                return (
                  <div key={line.cartKey} className="rounded-lg border border-white/5 bg-slate-900/50 p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-white flex-1 min-w-0">{line.item.name}</p>
                      <button onClick={() => removeLine(line.cartKey)} className="text-slate-600 hover:text-red-400 text-xs">x</button>
                    </div>
                    {line.selectedOptions.length > 0 && (
                      <p className="text-[9px] text-slate-500 mb-1">
                        {line.selectedOptions.map((so) => `${so.group}: ${so.choices.map((c) => c.name).join(", ")}`).join(" / ")}
                      </p>
                    )}
                    {isOverridden && line.overrideNote && (
                      <p className="text-[9px] text-amber-400 mb-1">Nota: {line.overrideNote}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(line.cartKey, -1)} className="h-6 w-6 rounded border border-white/10 text-white text-xs hover:bg-white/5">-</button>
                        <span className="text-xs font-bold text-white w-5 text-center">{line.quantity}</span>
                        <button onClick={() => changeQty(line.cartKey, 1)} className="h-6 w-6 rounded bg-primary text-white text-xs hover:bg-primary-dark">+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setOverriding(line)} className={`text-[9px] ${isOverridden ? "text-amber-400" : "text-slate-500 hover:text-primary"}`}>
                          {isOverridden ? "Modificado" : "Modificar $"}
                        </button>
                        <span className={`text-xs font-bold ${isOverridden ? "text-amber-400" : "text-white"}`}>
                          {formatARS(linePrice * line.quantity)}
                        </span>
                      </div>
                    </div>
                    {isOverridden && (
                      <button onClick={() => clearOverride(line.cartKey)} className="text-[9px] text-slate-600 hover:text-white mt-1">
                        Restaurar precio
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total</span>
              <span className="text-lg font-bold text-white">{formatARS(total)}</span>
            </div>
            <button
              onClick={() => setPaying(true)}
              disabled={cart.length === 0 || (mode === "DINE_IN" && !tableNumber.trim())}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 disabled:hover:shadow-md transition-all"
            >
              Cobrar
            </button>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="w-full text-[10px] text-slate-600 hover:text-red-400 transition-colors py-1">
                Vaciar pedido
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile cart FAB */}
      {!mobileCartOpen && cart.length > 0 && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 z-30 rounded-2xl bg-gradient-to-r from-primary to-amber-500 px-5 py-4 text-white font-bold shadow-2xl shadow-primary/30 flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <span className="bg-white/20 rounded-full h-7 w-7 flex items-center justify-center text-sm">{itemCount}</span>
            <span>Ver pedido</span>
          </span>
          <span>{formatARS(total)}</span>
        </button>
      )}

      {/* Customize sheet */}
      {customizing && (
        <ItemCustomizeSheet
          item={customizing}
          onAdd={(qty, opts, delta) => addCustomized(customizing, qty, opts, delta)}
          onClose={() => setCustomizing(null)}
        />
      )}

      {/* Price override sheet */}
      {overriding && (
        <PosPriceOverrideSheet
          line={overriding}
          onConfirm={(price, note) => applyPriceOverride(overriding.cartKey, price, note)}
          onClose={() => setOverriding(null)}
        />
      )}

      {/* Payment sheet */}
      {paying && (
        <PosPaymentSheet
          total={total}
          submitting={submitting}
          onPay={(method, tendered) => submitOrder(method, tendered)}
          onClose={() => { if (!submitting) setPaying(false); }}
        />
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-red-400/30 bg-red-400/10 backdrop-blur px-4 py-3 shadow-2xl animate-fade-in flex items-center gap-3">
          <p className="text-sm font-bold text-red-400">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">x</button>
        </div>
      )}

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-emerald-400/30 bg-emerald-400/10 backdrop-blur px-4 py-3 shadow-2xl animate-fade-in">
          <p className="text-sm font-bold text-emerald-400">Pedido creado: {showSuccess}</p>
          <p className="text-[10px] text-emerald-300/70 mt-0.5">Enviado a la cocina</p>
        </div>
      )}
    </div>
  );
}
