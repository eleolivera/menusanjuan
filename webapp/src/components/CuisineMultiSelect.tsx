"use client";

import { useState, useEffect } from "react";

type CuisineOption = { id: string; label: string; emoji: string };

export function CuisineMultiSelect({
  selected,
  onChange,
  darkMode = false,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  darkMode?: boolean;
}) {
  const [options, setOptions] = useState<CuisineOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cuisine-types")
      .then(r => r.json())
      .then(data => { setOptions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`h-9 w-24 rounded-lg animate-pulse ${darkMode ? "bg-white/5" : "bg-slate-100"}`} />
        ))}
      </div>
    );
  }

  const btnBase = darkMode
    ? "rounded-lg px-3 py-2 text-xs font-medium transition-all border"
    : "rounded-lg border px-3 py-2 text-xs font-medium transition-all";

  const btnActive = darkMode
    ? "bg-primary/15 text-primary border-primary/30"
    : "border-primary bg-primary/10 text-primary";

  const btnInactive = darkMode
    ? "border-white/10 text-slate-400 hover:border-white/20"
    : "border-border/60 text-text-secondary hover:border-primary/40";

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => toggle(opt.id)}
          className={`${btnBase} ${selected.includes(opt.id) ? btnActive : btnInactive}`}
        >
          <span className="mr-1">{opt.emoji}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
