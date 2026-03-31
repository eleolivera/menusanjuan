"use client";

import { useState, useEffect, useRef } from "react";

type CuisineOption = { id: string; label: string; emoji: string };

export function CuisinePills({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (label: string) => void;
}) {
  const [options, setOptions] = useState<CuisineOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/cuisine-types")
      .then(r => r.json())
      .then(data => setOptions(data))
      .catch(() => {});
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* "Todos" pill — always first */}
        <button
          onClick={() => onSelect("all")}
          className={`flex items-center gap-2 shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
            selected === "all"
              ? "bg-gradient-to-r from-primary to-amber-500 text-white shadow-md shadow-primary/20"
              : "bg-surface border border-border/60 text-text-secondary hover:border-primary/30 hover:text-text"
          }`}
        >
          <span className="text-lg">🍽️</span>
          Todos
        </button>

        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.label)}
            className={`flex items-center gap-2 shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
              selected === opt.label
                ? "bg-gradient-to-r from-primary to-amber-500 text-white shadow-md shadow-primary/20"
                : "bg-surface border border-border/60 text-text-secondary hover:border-primary/30 hover:text-text"
            }`}
          >
            <span className="text-lg">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
