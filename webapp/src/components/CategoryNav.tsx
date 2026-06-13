"use client";

import type { MenuCategoryData } from "@/data/menus";
import { getCategoryIcon } from "@/lib/category-icon";

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
            // Smart map the category name to a Lucide food icon — the
            // owner-side emoji picker stays, but the customer-facing nav
            // shows a clean line icon instead so the whole top strip reads
            // as a real product UI rather than a kid's menu.
            const Icon = getCategoryIcon(cat.name);
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
