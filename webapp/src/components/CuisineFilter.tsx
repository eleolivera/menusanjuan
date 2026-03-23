"use client";

import { CUISINE_TYPES } from "@/data/restaurants";

export function CuisineFilter({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CUISINE_TYPES.map((cuisine) => {
        const isActive = selected === cuisine.value;
        return (
          <button
            key={cuisine.value}
            onClick={() => onChange(cuisine.value)}
            className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-text-secondary hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <span className="mr-1.5">{cuisine.emoji}</span>
            {cuisine.label}
          </button>
        );
      })}
    </div>
  );
}
