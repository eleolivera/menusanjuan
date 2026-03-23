"use client";

import type { MenuCategoryData } from "@/data/menus";

export function CategoryNav({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: MenuCategoryData[];
  activeCategory: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="sticky top-16 z-40 border-b border-border/30 glass">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:text-primary hover:bg-primary/5"
                }`}
              >
                <span className="mr-1">{cat.emoji}</span>
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
