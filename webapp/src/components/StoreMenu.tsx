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
import { getLatestOrderRef, type OrderRef } from "@/lib/order-tracker";

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

  const searchParams = useSearchParams();

  // Check localStorage for pending orders on mount
  useEffect(() => {
    const ref = getLatestOrderRef(restaurant.slug);
    if (ref) setPendingOrder(ref);
  }, [restaurant.slug]);

  // Open customize sheet for a specific item via ?item= URL parameter (from main bot)
  useEffect(() => {
    const itemId = searchParams.get("item");
    if (!itemId) return;
    const allItems = categories.flatMap((c) => c.items);
    const item = allItems.find((i) => i.id === itemId);
    if (item) setCustomizingItem(item);
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

      <div className="mx-auto max-w-7xl px-4 py-6">
        {categories.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-4xl mb-4">🍽️</div>
            <h3 className="text-lg font-bold text-text mb-2">Menu en preparacion</h3>
            <p className="text-sm text-text-secondary">Este restaurante esta armando su menu. Volve pronto.</p>
          </div>
        )}
        {categories.map((category) => (
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
                .map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    totalInCart={getTotalQty(item.id)}
                    onClick={() => addItem(item)}
                  />
                ))}
            </div>
          </section>
        ))}
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
