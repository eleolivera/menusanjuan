"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import type { MenuCategoryData, MenuItemData, OptionGroupData } from "@/data/menus";
import { ItemCustomizeSheet, type SelectedOptions } from "@/components/ItemCustomizeSheet";
import { PosPaymentSheet } from "./PosPaymentSheet";
import { PosPriceOverrideSheet } from "./PosPriceOverrideSheet";
import { NumberPad } from "./NumberPad";
import { formatARS, normalize, timeAgo } from "@/lib/admin-utils";
import { computeCartTotal } from "@/lib/money";

function isVideo(url: string) {
  return /\.(mp4|mov|webm)/i.test(url);
}

function newCartKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `pos-${crypto.randomUUID()}`;
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

type OpenTable = {
  id: string;
  orderNumber: string;
  tableNumber: string | null;
  total: number;
  items: any[];
  createdAt: string;
};

type View = "tables" | "new-table" | "ordering";

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
  // ─── Menu state ───
  const [categories, setCategories] = useState<MenuCategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ─── Mode + view ───
  const [mode, setMode] = useState<Mode>("COUNTER");
  const [view, setView] = useState<View>("ordering"); // counter starts directly in ordering
  const [tableNumber, setTableNumber] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null); // existing mesa being edited
  const [openTables, setOpenTables] = useState<OpenTable[]>([]);

  // ─── Cart state ───
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [existingItems, setExistingItems] = useState<any[]>([]); // items already in the order (for mesa)
  const [customizing, setCustomizing] = useState<MenuItemData | null>(null);
  const [overriding, setOverriding] = useState<PosCartLine | null>(null);

  // ─── Submission state ───
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── Load menu ───
  useEffect(() => {
    type ApiOptionChoice = { id: string; name: string; priceDelta: number; available: boolean };
    type ApiOptionGroup = { id: string; title: string; minSelections: number; maxSelections: number; options: ApiOptionChoice[] };
    type ApiMenuItem = { id: string; name: string; description: string | null; price: number; imageUrl: string | null; badge: string | null; available: boolean; optionGroups?: ApiOptionGroup[] };
    type ApiCategory = { id: string; name: string; emoji: string | null; items: ApiMenuItem[] };

    fetch("/api/restaurante/menu")
      .then((r) => r.json())
      .then((cats: ApiCategory[]) => {
        const mapped: MenuCategoryData[] = cats.map((c) => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji || "🍽️",
          items: c.items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description || "",
            price: i.price,
            imageUrl: i.imageUrl || "",
            badge: i.badge || undefined,
            available: i.available,
            optionGroups: (i.optionGroups || [])
              .map((g): OptionGroupData => ({
                id: g.id,
                title: g.title,
                minSelections: g.minSelections,
                maxSelections: g.maxSelections,
                options: g.options.filter((o) => o.available).map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available })),
              }))
              .filter((g) => g.options.length > 0),
          })),
        }));
        setCategories(mapped);
        if (mapped.length > 0) setActiveCat(mapped[0].id);
        setLoading(false);
      });
  }, []);

  // ─── Load open tables ───
  const fetchOpenTables = useCallback(() => {
    fetch("/api/restaurante/pos/open-tables")
      .then((r) => r.json())
      .then((tables: OpenTable[]) => setOpenTables(tables))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOpenTables();
    const t = setInterval(fetchOpenTables, 15000);
    return () => clearInterval(t);
  }, [fetchOpenTables]);

  // When switching to mesa mode, show the tables view
  useEffect(() => {
    if (mode === "DINE_IN" && !activeOrderId && !tableNumber) setView("tables");
    if (mode === "COUNTER") setView("ordering");
  }, [mode]);

  // Auto-dismiss toasts
  useEffect(() => { if (!showSuccess) return; const t = setTimeout(() => setShowSuccess(null), 4000); return () => clearTimeout(t); }, [showSuccess]);
  useEffect(() => { if (!errorMsg) return; const t = setTimeout(() => setErrorMsg(null), 6000); return () => clearTimeout(t); }, [errorMsg]);

  // ─── Filter items by search ───
  const visibleItems = useMemo(() => {
    if (search.trim()) {
      const q = normalize(search);
      return categories.flatMap((c) => c.items.filter((i) => i.available && normalize(i.name).includes(q)));
    }
    const cat = categories.find((c) => c.id === activeCat);
    return cat ? cat.items.filter((i) => i.available) : [];
  }, [categories, activeCat, search]);

  // ─── Cart math ───
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const newItemsTotal = useMemo(() => computeCartTotal(cart.map((l) => ({
    unitPrice: l.item.price, priceOverride: l.priceOverride, optionsDelta: l.optionsDelta, quantity: l.quantity,
  }))), [cart]);
  const existingTotal = useMemo(() => existingItems.reduce((s, it: any) => s + (it.total || 0), 0), [existingItems]);
  const grandTotal = newItemsTotal + existingTotal;

  // ─── Cart actions ───
  function handleAddItem(item: MenuItemData) {
    if (item.optionGroups && item.optionGroups.length > 0) {
      setCustomizing(item);
    } else {
      setCart((prev) => {
        const existing = prev.find((l) => l.item.id === item.id && l.selectedOptions.length === 0 && l.priceOverride === undefined);
        if (existing) return prev.map((l) => l.cartKey === existing.cartKey ? { ...l, quantity: l.quantity + 1 } : l);
        return [...prev, { cartKey: newCartKey(), item, quantity: 1, selectedOptions: [], optionsDelta: 0 }];
      });
    }
  }

  function addCustomized(item: MenuItemData, quantity: number, selectedOptions: SelectedOptions, optionsDelta: number) {
    setCart((prev) => {
      const optionsKey = JSON.stringify(selectedOptions);
      const existing = prev.find((l) => l.item.id === item.id && l.priceOverride === undefined && JSON.stringify(l.selectedOptions) === optionsKey);
      if (existing) return prev.map((l) => l.cartKey === existing.cartKey ? { ...l, quantity: l.quantity + quantity } : l);
      return [...prev, { cartKey: newCartKey(), item, quantity, selectedOptions, optionsDelta }];
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

  // ─── Mesa actions ───
  function openExistingTable(table: OpenTable) {
    setActiveOrderId(table.id);
    setTableNumber(table.tableNumber || "");
    setExistingItems(table.items || []);
    setCart([]);
    setView("ordering");
  }

  function backToTables() {
    setActiveOrderId(null);
    setTableNumber("");
    setExistingItems([]);
    setCart([]);
    setView("tables");
    fetchOpenTables();
  }

  function startNewTable() {
    setActiveOrderId(null);
    setTableNumber("");
    setExistingItems([]);
    setCart([]);
    setView("new-table");
  }

  function confirmNewTable() {
    if (!tableNumber.trim()) return;
    setView("ordering");
  }

  // ─── Submit ───
  function buildItemsPayload() {
    return cart.map((line) => {
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
  }

  /** Mostrador: create order, mark paid, send to kitchen */
  async function submitMostrador(paymentMethod: string, cashTendered?: number) {
    if (submitting) return;
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/restaurante/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: buildItemsPayload(),
          channel: "COUNTER",
          paymentMethod,
          cashTendered,
          source: "pos-tablet",
        }),
      });
      if (res.ok) {
        const order = await res.json();
        setShowSuccess(order.orderNumber);
        setCart([]);
        setPaying(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Error al crear pedido");
      }
    } catch { setErrorMsg("Error de conexion"); }
    finally { setSubmitting(false); }
  }

  /** Mesa: create new order (UNPAID, kept open) and send items to kitchen */
  async function createMesa() {
    if (submitting) return;
    if (!tableNumber.trim()) { setErrorMsg("Falta numero de mesa"); return; }
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/restaurante/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: buildItemsPayload(),
          channel: "DINE_IN",
          tableNumber: tableNumber.trim(),
          source: "pos-tablet",
        }),
      });
      if (res.ok) {
        const order = await res.json();
        setShowSuccess(`Mesa ${tableNumber} abierta — ${order.orderNumber}`);
        // Update suggestions + return to tables view
        const updated = [tableNumber.trim(), ...tableSuggestions.filter((t) => t !== tableNumber.trim())].slice(0, 30);
        onSuggestionsUpdate(updated);
        backToTables();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Error al crear mesa");
      }
    } catch { setErrorMsg("Error de conexion"); }
    finally { setSubmitting(false); }
  }

  /** Mesa: append items to an existing open order */
  async function appendToMesa() {
    if (submitting) return;
    if (!activeOrderId || cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/restaurante/pos/orders/${activeOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append-items", items: buildItemsPayload() }),
      });
      if (res.ok) {
        setShowSuccess(`Items agregados a Mesa ${tableNumber}`);
        backToTables();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Error al agregar items");
      }
    } catch { setErrorMsg("Error de conexion"); }
    finally { setSubmitting(false); }
  }

  /** Mesa: pay an existing open order */
  async function payMesa(paymentMethod: string, cashTendered?: number) {
    if (submitting) return;
    if (!activeOrderId) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // First append any new items
      if (cart.length > 0) {
        const appendRes = await fetch(`/api/restaurante/pos/orders/${activeOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "append-items", items: buildItemsPayload() }),
        });
        if (!appendRes.ok) throw new Error("append-failed");
      }
      // Then mark paid
      const res = await fetch(`/api/restaurante/pos/orders/${activeOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", paymentMethod, cashTendered }),
      });
      if (res.ok) {
        setShowSuccess(`Mesa ${tableNumber} cobrada`);
        setPaying(false);
        backToTables();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Error al cobrar");
      }
    } catch { setErrorMsg("Error de conexion"); }
    finally { setSubmitting(false); }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-white/5 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {view === "ordering" && mode === "DINE_IN" && (activeOrderId || tableNumber) && (
            <button onClick={backToTables} className="text-slate-400 hover:text-white text-lg px-1">←</button>
          )}
          <h1 className="text-sm font-bold text-white truncate">{restaurantName}</h1>
          {mode === "DINE_IN" && tableNumber && view === "ordering" && (
            <span className="text-xs text-cyan-400 font-semibold">· Mesa {tableNumber}</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setMode("COUNTER")} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${mode === "COUNTER" ? "bg-primary text-white" : "bg-white/5 text-slate-400"}`}>
            Mostrador
          </button>
          <button onClick={() => setMode("DINE_IN")} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${mode === "DINE_IN" ? "bg-primary text-white" : "bg-white/5 text-slate-400"}`}>
            Mesas
          </button>
        </div>
      </div>

      {/* ─── Mesa: Tables view ─── */}
      {mode === "DINE_IN" && view === "tables" && (
        <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Mesas activas</h2>
              <button onClick={startNewTable} className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg active:scale-95 transition-all">
                + Nueva mesa
              </button>
            </div>
            {openTables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                <p className="text-sm text-slate-500 mb-1">No hay mesas activas</p>
                <p className="text-[11px] text-slate-600">Tocá "Nueva mesa" para empezar</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {openTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openExistingTable(t)}
                    className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-left hover:border-cyan-400/40 hover:bg-cyan-400/10 active:scale-95 transition-all"
                  >
                    <p className="text-2xl font-extrabold text-cyan-400">Mesa {t.tableNumber}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{t.orderNumber}</p>
                    <p className="text-sm font-bold text-white mt-2">{formatARS(t.total)}</p>
                    <p className="text-[10px] text-slate-600">{(t.items || []).length} items · {timeAgo(t.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Mesa: New table number entry ─── */}
      {mode === "DINE_IN" && view === "new-table" && (
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center" style={{ minHeight: 0 }}>
          <div className="w-full max-w-xs">
            <div className="text-center mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Numero de mesa</p>
              <p className="text-5xl font-extrabold text-white mt-2">{tableNumber || "—"}</p>
            </div>

            {tableSuggestions.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-slate-600 mb-1">Recientes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {tableSuggestions.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTableNumber(t)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <NumberPad
              value={tableNumber}
              onChange={setTableNumber}
              maxLength={4}
              onEnter={confirmNewTable}
            />

            <button onClick={backToTables} className="mt-3 w-full text-xs text-slate-500 hover:text-white py-2 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ─── Ordering view (mostrador OR mesa-with-table) ─── */}
      {view === "ordering" && (
        <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
          {/* Menu side */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
            <div className="shrink-0 px-3 py-2 border-b border-white/5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar item..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
              />
            </div>

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

            <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
              {visibleItems.length === 0 ? (
                <div className="text-center py-12">
                  {search.trim() ? (
                    <>
                      <p className="text-xs text-slate-500 mb-2">Sin resultados para "{search}"</p>
                      <button onClick={() => setSearch("")} className="text-[10px] text-primary hover:underline">Limpiar busqueda</button>
                    </>
                  ) : categories.length === 0 ? (
                    <p className="text-xs text-slate-500">Tu menu esta vacio</p>
                  ) : (
                    <p className="text-xs text-slate-600">Sin items disponibles</p>
                  )}
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
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-white/5">
                          {isVideo(item.imageUrl) ? (
                            <video src={item.imageUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                          ) : (
                            <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 640px) 50vw, 200px" className="object-cover" />
                          )}
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

          {/* Cart side */}
          <div className="w-72 sm:w-80 shrink-0 flex flex-col bg-slate-900/30">
            <div className="shrink-0 px-4 py-2 border-b border-white/5">
              <h2 className="text-xs font-bold text-white">
                {mode === "DINE_IN" ? `Mesa ${tableNumber}` : "Pedido"}
              </h2>
              <p className="text-[10px] text-slate-500">{itemCount + existingItems.length} items totales</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ minHeight: 0 }}>
              {/* Existing items in mesa (already sent to kitchen) */}
              {existingItems.length > 0 && (
                <>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider">Ya en cocina</p>
                  {existingItems.map((it: any, i: number) => (
                    <div key={i} className="rounded-lg border border-white/5 bg-slate-900/30 p-2 opacity-60">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">{it.quantity}x {it.name}</span>
                        <span className="text-slate-400">{formatARS(it.total || 0)}</span>
                      </div>
                    </div>
                  ))}
                  {cart.length > 0 && <p className="text-[9px] text-slate-600 uppercase tracking-wider mt-3">Por agregar</p>}
                </>
              )}

              {cart.length === 0 && existingItems.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-8">Tocar items para agregar</p>
              ) : (
                cart.map((line) => {
                  const linePrice = line.priceOverride !== undefined ? line.priceOverride : (line.item.price + line.optionsDelta);
                  const isOverridden = line.priceOverride !== undefined;
                  return (
                    <div key={line.cartKey} className="rounded-lg border border-white/5 bg-slate-900/50 p-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-white flex-1 min-w-0">{line.item.name}</p>
                        <button onClick={() => removeLine(line.cartKey)} className="text-slate-600 hover:text-red-400 text-xs px-1">×</button>
                      </div>
                      {line.selectedOptions.length > 0 && (
                        <p className="text-[9px] text-slate-500 mb-1">
                          {line.selectedOptions.map((so) => `${so.group}: ${so.choices.map((c) => c.name).join(", ")}`).join(" / ")}
                        </p>
                      )}
                      {isOverridden && line.overrideNote && (
                        <p className="text-[9px] text-amber-400 mb-1">{line.overrideNote}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => changeQty(line.cartKey, -1)} className="h-7 w-7 rounded border border-white/10 text-white text-xs hover:bg-white/5">−</button>
                          <span className="text-xs font-bold text-white w-5 text-center">{line.quantity}</span>
                          <button onClick={() => changeQty(line.cartKey, 1)} className="h-7 w-7 rounded bg-primary text-white text-xs hover:bg-primary-dark">+</button>
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

            {/* Sticky footer with Cobrar — always visible */}
            <div className="shrink-0 border-t border-white/5 p-3 space-y-2 bg-slate-900/50">
              {existingItems.length > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">En cocina</span>
                  <span className="text-slate-400">{formatARS(existingTotal)}</span>
                </div>
              )}
              {cart.length > 0 && existingItems.length > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Por agregar</span>
                  <span className="text-slate-400">{formatARS(newItemsTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Total</span>
                <span className="text-2xl font-extrabold text-white">{formatARS(grandTotal)}</span>
              </div>

              {mode === "COUNTER" ? (
                <button
                  onClick={() => setPaying(true)}
                  disabled={cart.length === 0}
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
                >
                  Cobrar {formatARS(grandTotal)}
                </button>
              ) : activeOrderId ? (
                <div className="space-y-2">
                  <button
                    onClick={appendToMesa}
                    disabled={cart.length === 0 || submitting}
                    className="w-full rounded-xl border border-primary/30 bg-primary/10 py-3 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-30 transition-all"
                  >
                    {submitting ? "..." : `+ Agregar ${cart.length} item${cart.length !== 1 ? "s" : ""} a la mesa`}
                  </button>
                  <button
                    onClick={() => setPaying(true)}
                    className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all"
                  >
                    Cobrar mesa {formatARS(grandTotal)}
                  </button>
                </div>
              ) : (
                <button
                  onClick={createMesa}
                  disabled={cart.length === 0 || submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25 hover:shadow-lg disabled:opacity-30 transition-all"
                >
                  {submitting ? "..." : `Abrir mesa con ${cart.length} item${cart.length !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
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

      {/* Payment sheet — pre-pay (mostrador) or post-pay (mesa) */}
      {paying && (
        <PosPaymentSheet
          total={grandTotal}
          submitting={submitting}
          onPay={(method, tendered) => {
            if (mode === "COUNTER") submitMostrador(method, tendered);
            else if (activeOrderId) payMesa(method, tendered);
          }}
          onClose={() => { if (!submitting) setPaying(false); }}
        />
      )}

      {/* Toasts */}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-red-400/30 bg-red-400/10 backdrop-blur px-4 py-3 shadow-2xl animate-fade-in flex items-center gap-3 max-w-sm">
          <p className="text-sm font-bold text-red-400">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">×</button>
        </div>
      )}

      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-emerald-400/30 bg-emerald-400/10 backdrop-blur px-4 py-3 shadow-2xl animate-fade-in max-w-sm">
          <p className="text-sm font-bold text-emerald-400">{showSuccess}</p>
        </div>
      )}
    </div>
  );
}
