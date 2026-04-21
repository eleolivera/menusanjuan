"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { MenuCategoryData, MenuItemData } from "@/data/menus";
import type { Restaurant } from "@/data/restaurants";
import type { DeliveryConfig } from "@/lib/delivery";
import { CategoryNav } from "./CategoryNav";
import { MenuItemCard } from "./MenuItemCard";
import { FloatingCart } from "./FloatingCart";
import { OrderModal } from "./OrderModal";
import { ItemCustomizeSheet, type SelectedOptions } from "./ItemCustomizeSheet";
import { OrderStatusBanner } from "./OrderStatusBanner";
import { StoreCompanion } from "./StoreCompanion";
import { getLatestOrderRef, getOrderRefs, type OrderRef } from "@/lib/order-tracker";

// Search results component — filters items across all categories
function SearchResults({
  search,
  categories,
  getTotalQty,
  onAddItem,
}: {
  search: string;
  categories: MenuCategoryData[];
  getTotalQty: (id: string) => number;
  onAddItem: (item: MenuItemData) => void;
}) {
  const q = search.toLowerCase().trim();
  const allItems = categories.flatMap((c) => c.items.filter((i) => i.available));
  const results = allItems.filter((item) =>
    item.name.toLowerCase().includes(q) ||
    (item.description && item.description.toLowerCase().includes(q))
  );

  if (results.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-3xl mb-3">🔍</div>
        <p className="text-sm text-text-secondary">No encontramos "{search}"</p>
        <p className="text-xs text-text-muted mt-1">Probá con otra palabra</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-3">{results.length} resultado{results.length !== 1 ? "s" : ""}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {results.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            totalInCart={getTotalQty(item.id)}
            onClick={() => onAddItem(item)}
          />
        ))}
      </div>
    </div>
  );
}

export type CartEntry = {
  cartKey: string;
  item: MenuItemData;
  quantity: number;
  selectedOptions: SelectedOptions;
  optionsDelta: number;
  note: string;
};

let cartKeyCounter = 0;

export function StoreMenu({
  restaurant,
  categories,
  deliveryConfig,
}: {
  restaurant: Restaurant;
  categories: MenuCategoryData[];
  deliveryConfig?: DeliveryConfig | null;
}) {
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [showModal, setShowModal] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);
  const [pendingOrder, setPendingOrder] = useState<OrderRef | null>(null);
  const [trackingMode, setTrackingMode] = useState(false);
  const [search, setSearch] = useState("");
  const [pastOrders, setPastOrders] = useState<OrderRef[]>([]);
  const [reordering, setReordering] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "warn" | "info" } | null>(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const searchParams = useSearchParams();

  // Check localStorage for pending orders on mount
  useEffect(() => {
    const ref = getLatestOrderRef(restaurant.slug);
    if (ref) setPendingOrder(ref);
    // Load past orders for this restaurant (for re-order)
    setPastOrders(getOrderRefs(restaurant.slug));
  }, [restaurant.slug]);

  // Re-sync past orders whenever pending order changes (new checkout, or dismissal)
  useEffect(() => {
    setPastOrders(getOrderRefs(restaurant.slug));
  }, [pendingOrder, restaurant.slug]);

  // Re-order: fetch a past order and pre-fill the cart with those items
  const reorderFromPast = useCallback(async (orderId: string, token: string) => {
    if (reordering) return;
    setReordering(true);
    try {
      const res = await fetch(`/api/orders/track?id=${orderId}&token=${token}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const orderItems = data.items as { menuItemId: string; quantity: number; name: string; unitPrice: number; optionsDelta?: number; selectedOptions?: SelectedOptions; note?: string }[];
      const allItems = categories.flatMap((c) => c.items);
      const entries: CartEntry[] = [];
      for (const oi of orderItems) {
        const item = allItems.find((i) => i.id === oi.menuItemId);
        if (item) {
          // Recalculate optionsDelta from CURRENT menu prices (menu may have changed since last order)
          let currentDelta = 0;
          const currentSelectedOptions: SelectedOptions = [];
          if (oi.selectedOptions && oi.selectedOptions.length > 0) {
            for (const so of oi.selectedOptions) {
              const currentGroup = item.optionGroups?.find((g) => g.id === so.groupId);
              if (!currentGroup) continue; // group was deleted
              const validChoices: { name: string; priceDelta: number }[] = [];
              for (const choice of so.choices) {
                const currentOption = currentGroup.options.find((o) => o.name === choice.name);
                if (currentOption && currentOption.available) {
                  validChoices.push({ name: currentOption.name, priceDelta: currentOption.priceDelta });
                  currentDelta += currentOption.priceDelta;
                }
              }
              if (validChoices.length > 0) {
                currentSelectedOptions.push({
                  group: so.group,
                  groupId: so.groupId,
                  choices: validChoices,
                  delta: validChoices.reduce((s, c) => s + c.priceDelta, 0),
                });
              }
            }
          }
          entries.push({
            cartKey: `ck-reorder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            item,
            quantity: oi.quantity,
            selectedOptions: currentSelectedOptions,
            optionsDelta: currentDelta,
            note: oi.note || "",
          });
        }
      }
      if (entries.length > 0) {
        setCart(entries);
        setShowModal(true);
        const skipped = orderItems.length - entries.length;
        if (skipped > 0) {
          setToast({
            message: `${skipped} producto${skipped > 1 ? "s" : ""} del pedido anterior ya no está${skipped > 1 ? "n" : ""} disponible${skipped > 1 ? "s" : ""}.`,
            kind: "warn",
          });
        }
      } else {
        setToast({ message: "Ninguno de los productos del pedido anterior sigue disponible.", kind: "warn" });
      }
    } catch {
      setToast({ message: "No pudimos cargar el pedido anterior.", kind: "warn" });
    } finally {
      setReordering(false);
    }
  }, [reordering, categories]);

  // Open customize sheet for a specific item via ?item= URL parameter (from main bot)
  useEffect(() => {
    const itemId = searchParams.get("item");
    if (!itemId) return;
    const allItems = categories.flatMap((c) => c.items);
    const item = allItems.find((i) => i.id === itemId);
    if (item) {
      setCustomizingItem(item);
    } else {
      // Let user know the item isn't available anymore
      setToast({ message: "Ese producto ya no está disponible.", kind: "warn" });
    }
    // Clear the param so reload doesn't re-trigger
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("item");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, categories]);

  // Pre-fill cart from ?pedido= URL parameter (used by WhatsApp bot)
  useEffect(() => {
    const pedido = searchParams.get("pedido");
    if (!pedido) return;
    try {
      const decoded = JSON.parse(atob(pedido)) as { id: string; qty: number; options?: string; notes?: string }[];
      const allItems = categories.flatMap((c) => c.items);
      const entries: CartEntry[] = [];
      for (const { id, qty, options, notes } of decoded) {
        const item = allItems.find((i) => i.id === id);
        if (item && qty > 0) {
          // Parse options string into SelectedOptions format if provided
          const selectedOptions: SelectedOptions = [];
          if (options) {
            selectedOptions.push({
              group: "Opciones",
              groupId: "bot",
              choices: options.split(",").map((o) => ({ name: o.trim(), priceDelta: 0 })),
              delta: 0,
            });
          }
          entries.push({
            cartKey: `ck-${++cartKeyCounter}`,
            item,
            quantity: qty,
            selectedOptions,
            optionsDelta: 0,
            note: notes || "",
          });
        }
      }
      if (entries.length > 0) {
        setCart(entries);
        setShowModal(true);
      }
    } catch {
      // Invalid pedido param — ignore
    }
    // Clear the param so reload doesn't re-trigger
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("pedido");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, categories]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // All item taps open the customization sheet
  const addItem = useCallback((item: MenuItemData) => {
    setCustomizingItem(item);
  }, []);

  const addCustomized = useCallback((item: MenuItemData, quantity: number, selectedOptions: SelectedOptions, optionsDelta: number, note: string) => {
    setCart((prev) => [...prev, {
      cartKey: `ck-${++cartKeyCounter}`,
      item,
      quantity,
      selectedOptions,
      optionsDelta,
      note,
    }]);
    setCustomizingItem(null);
  }, []);

  const incrementEntry = useCallback((cartKey: string) => {
    setCart((prev) => prev.map((e) => e.cartKey === cartKey ? { ...e, quantity: e.quantity + 1 } : e));
  }, []);

  const decrementEntry = useCallback((cartKey: string) => {
    setCart((prev) => {
      const entry = prev.find((e) => e.cartKey === cartKey);
      if (!entry) return prev;
      if (entry.quantity <= 1) return prev.filter((e) => e.cartKey !== cartKey);
      return prev.map((e) => e.cartKey === cartKey ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }, []);

  const updateNote = useCallback((cartKey: string, note: string) => {
    setCart((prev) => prev.map((e) => e.cartKey === cartKey ? { ...e, note } : e));
  }, []);

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Compute totals
  const totalItems = cart.reduce((s, e) => s + e.quantity, 0);
  const totalPrice = cart.reduce((s, e) => s + (e.item.price + e.optionsDelta) * e.quantity, 0);

  // Total quantity for an item across all cart entries (any options/notes)
  function getTotalQty(itemId: string): number {
    return cart.filter((e) => e.item.id === itemId).reduce((s, e) => s + e.quantity, 0);
  }

  // Convert cart to the format OrderModal expects
  const cartForModal = cart.map((e) => ({
    item: e.item,
    quantity: e.quantity,
    cartKey: e.cartKey,
    selectedOptions: e.selectedOptions,
    optionsDelta: e.optionsDelta,
    note: e.note,
  }));

  return (
    <>
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onSelect={scrollToCategory}
      />

      {/* Pending order banner */}
      {pendingOrder && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <OrderStatusBanner
            orderId={pendingOrder.orderId}
            token={pendingOrder.token}
            orderNumber={pendingOrder.orderNumber}
            onTap={() => { setTrackingMode(true); setShowModal(true); }}
            onDismiss={() => setPendingOrder(null)}
          />
        </div>
      )}

      {/* Re-order from history */}
      {pastOrders.length > 0 && !pendingOrder && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <button
            onClick={() => reorderFromPast(pastOrders[0].orderId, pastOrders[0].token)}
            disabled={reordering}
            className="w-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
              🔄
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold text-text">Repetir pedido anterior</div>
              <div className="text-[11px] text-text-muted">Pedido {pastOrders[0].orderNumber} — {new Date(pastOrders[0].placedAt).toLocaleDateString("es-AR")}</div>
            </div>
            <span className="text-xs font-semibold text-primary">{reordering ? "Cargando..." : "Pedir de nuevo"}</span>
          </button>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6">
        {categories.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-4xl mb-4">🍽️</div>
            <h3 className="text-lg font-bold text-text mb-2">Menu en preparacion</h3>
            <p className="text-sm text-text-secondary">Este restaurante esta armando su menu. Volve pronto.</p>
          </div>
        )}

        {/* Menu search */}
        {categories.length > 0 && (
          <div className="mb-6 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en el menu..."
              className="w-full rounded-xl border border-border bg-white pl-10 pr-4 py-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Search results or full menu */}
        {search.trim() ? (
          <SearchResults
            search={search}
            categories={categories}
            getTotalQty={getTotalQty}
            onAddItem={addItem}
          />
        ) : (
          <>
            {categories.map((category, catIdx) => (
              <section
                key={category.id}
                ref={(el) => { sectionRefs.current[category.id] = el; }}
                className="mb-10 scroll-mt-32"
              >
                <h2 className="mb-4 text-xl font-bold text-text flex items-center gap-2">
                  <span>{category.emoji}</span>
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {category.items
                    .filter((item) => item.available)
                    .map((item, itemIdx) => (
                      <MenuItemCard
                        key={item.id}
                        item={catIdx === 0 && itemIdx < 3 ? { ...item, badge: item.badge || "Popular" } : item}
                        totalInCart={getTotalQty(item.id)}
                        onClick={() => addItem(item)}
                      />
                    ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      <FloatingCart
        itemCount={totalItems}
        total={totalPrice}
        onClick={() => { setTrackingMode(false); setShowModal(true); }}
        pendingOrderNumber={pendingOrder?.orderNumber}
        onViewOrder={() => { setTrackingMode(true); setShowModal(true); }}
      />

      {showModal && (
        <OrderModal
          items={cartForModal}
          total={totalPrice}
          restaurantName={restaurant.name}
          restaurantPhone={restaurant.phone}
          restauranteSlug={restaurant.slug}
          deliveryConfig={deliveryConfig}
          onClose={() => { setShowModal(false); setTrackingMode(false); }}
          onRemove={decrementEntry}
          onAdd={incrementEntry}
          onUpdateNote={updateNote}
          onClearCart={() => setCart([])}
          onOrderSent={(id, token, num) => {
            setPendingOrder({ orderId: id, token, orderNumber: num, placedAt: new Date().toISOString() });
          }}
          trackingOrder={trackingMode && pendingOrder ? { orderId: pendingOrder.orderId, token: pendingOrder.token, orderNumber: pendingOrder.orderNumber } : null}
        />
      )}

      {customizingItem && (
        <ItemCustomizeSheet
          item={customizingItem}
          onAdd={(qty, opts, delta, note) => addCustomized(customizingItem, qty, opts, delta, note)}
          onClose={() => setCustomizingItem(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className={`rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${
            toast.kind === "warn" ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* AI Shopping Companion */}
      <StoreCompanion
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        categories={categories}
        cart={cart}
        onAddToCart={(item, qty, opts, delta, note) => {
          setCart((prev) => [...prev, {
            cartKey: `ck-companion-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            item,
            quantity: qty,
            selectedOptions: opts,
            optionsDelta: delta,
            note,
          }]);
        }}
        onRemoveFromCart={decrementEntry}
        onClearCart={() => setCart([])}
        onOpenCheckout={() => { setTrackingMode(false); setShowModal(true); }}
      />
    </>
  );
}
