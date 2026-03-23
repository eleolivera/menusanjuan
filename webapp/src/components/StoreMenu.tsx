"use client";

import { useState, useCallback, useRef } from "react";
import type { MenuCategoryData, MenuItemData } from "@/data/menus";
import type { Restaurant } from "@/data/restaurants";
import { CategoryNav } from "./CategoryNav";
import { MenuItemCard } from "./MenuItemCard";
import { FloatingCart } from "./FloatingCart";
import { OrderModal } from "./OrderModal";

export function StoreMenu({
  restaurant,
  categories,
}: {
  restaurant: Restaurant;
  categories: MenuCategoryData[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");
  const [showModal, setShowModal] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const addItem = useCallback((itemId: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (next[itemId] > 1) {
        next[itemId]--;
      } else {
        delete next[itemId];
      }
      return next;
    });
  }, []);

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    sectionRefs.current[catId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // Compute cart
  const allItems = categories.flatMap((c) => c.items);
  const cartItems = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, quantity]) => ({
      item: allItems.find((i) => i.id === itemId)!,
      quantity,
    }))
    .filter((ci) => ci.item);

  const totalItems = cartItems.reduce((s, ci) => s + ci.quantity, 0);
  const totalPrice = cartItems.reduce(
    (s, ci) => s + ci.item.price * ci.quantity,
    0
  );

  return (
    <>
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onSelect={scrollToCategory}
      />

      <div className="mx-auto max-w-7xl px-4 py-6">
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
                    quantity={quantities[item.id] || 0}
                    onAdd={() => addItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>

      <FloatingCart
        itemCount={totalItems}
        total={totalPrice}
        onClick={() => setShowModal(true)}
      />

      {showModal && (
        <OrderModal
          items={cartItems}
          total={totalPrice}
          restaurantName={restaurant.name}
          restaurantPhone={restaurant.phone}
          restauranteSlug={restaurant.slug}
          onClose={() => setShowModal(false)}
          onRemove={removeItem}
          onAdd={addItem}
        />
      )}
    </>
  );
}
