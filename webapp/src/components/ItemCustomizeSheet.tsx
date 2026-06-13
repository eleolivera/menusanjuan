"use client";

import { useRef, useState } from "react";
import type { MenuItemData, OptionGroupData } from "@/data/menus";

export type SelectedOptions = {
  group: string;
  groupId: string;
  choices: { name: string; priceDelta: number }[];
  delta: number;
}[];

/** Customizations applied to a single component (slot) of a promo. */
export type ComponentSelection = {
  componentId: string;
  childItemId: string;
  label: string;
  selectedOptions: SelectedOptions;
  optionsDelta: number;
};

type Props = {
  item: MenuItemData;
  onAdd: (
    quantity: number,
    selectedOptions: SelectedOptions,
    optionsDelta: number,
    note: string,
    componentSelections?: ComponentSelection[],
  ) => void;
  onClose: () => void;
};

const MAX_NOTE_LENGTH = 200;

// Selections state is a 2-level Record so we can index by either "parent" (the
// item's own groups) or a componentId (each promo slot's groups), and then by
// groupId within that surface.
type SelectionsState = Record<string, Record<string, Set<string>>>;
const PARENT_KEY = "__parent__";

export function ItemCustomizeSheet({ item, onAdd, onClose }: Props) {
  const components = item.components || [];
  const hasComponents = components.length > 0;
  const parentGroups = item.optionGroups || [];

  // Build the initial selections map covering the parent's groups + each
  // component's child groups. All start empty; we mutate via toggleOption.
  const [selections, setSelections] = useState<SelectionsState>(() => {
    const init: SelectionsState = {};
    init[PARENT_KEY] = {};
    parentGroups.forEach((g) => { init[PARENT_KEY][g.id] = new Set(); });
    components.forEach((c) => {
      init[c.id] = {};
      (c.child.optionGroups || []).forEach((g) => { init[c.id][g.id] = new Set(); });
    });
    return init;
  });
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  // One ref per group across both parent + component surfaces. Key shape:
  // `${surfaceKey}__${groupId}` so we can resolve any group uniquely.
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pulseRefKey, setPulseRefKey] = useState<string | null>(null);

  function toggleOption(surface: string, groupId: string, optionName: string, group: OptionGroupData) {
    setSelections((prev) => {
      const surfaceMap = { ...(prev[surface] || {}) };
      const set = new Set(surfaceMap[groupId] || []);

      if (group.maxSelections === 1) {
        set.clear();
        set.add(optionName);
      } else {
        if (set.has(optionName)) {
          set.delete(optionName);
        } else if (set.size < group.maxSelections) {
          set.add(optionName);
        }
      }

      surfaceMap[groupId] = set;
      return { ...prev, [surface]: surfaceMap };
    });
  }

  function isGroupComplete(surface: string, g: OptionGroupData): boolean {
    if (g.minSelections === 0) return true;
    const set = selections[surface]?.[g.id];
    return (set?.size || 0) >= g.minSelections;
  }

  // Sum the option price deltas for a single (surface, group set) — used both
  // for the parent surface and per-component surface.
  function deltaForSurface(surface: string, groups: OptionGroupData[]): number {
    let delta = 0;
    groups.forEach((g) => {
      g.options.forEach((o) => {
        if (selections[surface]?.[g.id]?.has(o.name)) delta += o.priceDelta;
      });
    });
    return delta;
  }

  // Build the {surface, groupId, refKey} list in render order — used by the
  // scroll-to-missing handler to find the FIRST incomplete required group.
  type GroupRow = { surface: string; group: OptionGroupData; refKey: string };
  const allGroupRows: GroupRow[] = [
    ...parentGroups.map((g) => ({ surface: PARENT_KEY, group: g, refKey: `${PARENT_KEY}__${g.id}` })),
    ...components.flatMap((c) =>
      (c.child.optionGroups || []).map((g) => ({
        surface: c.id,
        group: g,
        refKey: `${c.id}__${g.id}`,
      }))
    ),
  ];
  const allRequiredMet = allGroupRows.every((r) => isGroupComplete(r.surface, r.group));

  const parentDelta = deltaForSurface(PARENT_KEY, parentGroups);
  const componentDeltas = components.map((c) => deltaForSurface(c.id, c.child.optionGroups || []));
  const totalOptionsDelta = parentDelta + componentDeltas.reduce((s, d) => s + d, 0);
  const totalPrice = (item.price + totalOptionsDelta) * quantity;

  function buildSelectedOptions(surface: string, groups: OptionGroupData[]): SelectedOptions {
    return groups
      .filter((g) => (selections[surface]?.[g.id]?.size || 0) > 0)
      .map((g) => {
        const chosen = g.options.filter((o) => selections[surface]?.[g.id]?.has(o.name));
        return {
          group: g.title,
          groupId: g.id,
          choices: chosen.map((o) => ({ name: o.name, priceDelta: o.priceDelta })),
          delta: chosen.reduce((s, o) => s + o.priceDelta, 0),
        };
      });
  }

  function handleAdd() {
    if (!allRequiredMet) {
      // Scroll to first incomplete group, with a pulse to draw the eye.
      const firstMissing = allGroupRows.find((r) => !isGroupComplete(r.surface, r.group));
      if (firstMissing) {
        groupRefs.current[firstMissing.refKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
        setPulseRefKey(firstMissing.refKey);
        setTimeout(() => setPulseRefKey(null), 1200);
      }
      return;
    }

    const parentSelectedOptions = buildSelectedOptions(PARENT_KEY, parentGroups);
    const componentSelections: ComponentSelection[] = components.map((c, i) => ({
      componentId: c.id,
      childItemId: c.childItemId,
      label: c.label,
      selectedOptions: buildSelectedOptions(c.id, c.child.optionGroups || []),
      optionsDelta: componentDeltas[i],
    }));

    onAdd(
      quantity,
      parentSelectedOptions,
      totalOptionsDelta,
      note.trim(),
      hasComponents ? componentSelections : undefined,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full sm:max-w-md max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with item image */}
        {item.imageUrl && (
          <div className="relative h-40 bg-slate-100 shrink-0">
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Item info */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          {!item.imageUrl && (
            <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          <h2 className="text-lg font-bold text-text">{item.name}</h2>
          {item.description && <p className="text-sm text-text-secondary mt-0.5">{item.description}</p>}
          <p className="text-base font-bold text-primary mt-1">${item.price.toLocaleString("es-AR")}</p>
        </div>

        {/* Scrollable content: option groups + notes */}
        <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ minHeight: 0 }}>
          {/* Parent item's own option groups (rare on a promo; common on a normal item) */}
          {parentGroups.length > 0 && (
            <>
              {hasComponents && (
                <div className="mt-4 text-[10px] uppercase tracking-wider text-text-muted font-bold">
                  Opciones del combo
                </div>
              )}
              {parentGroups.map((g) => {
                const refKey = `${PARENT_KEY}__${g.id}`;
                return (
                  <OptionGroupBlock
                    key={refKey}
                    group={g}
                    selected={selections[PARENT_KEY]?.[g.id] || new Set()}
                    complete={isGroupComplete(PARENT_KEY, g)}
                    pulse={pulseRefKey === refKey}
                    registerRef={(el) => { groupRefs.current[refKey] = el; }}
                    onToggle={(optName) => toggleOption(PARENT_KEY, g.id, optName, g)}
                  />
                );
              })}
            </>
          )}

          {/* Per-component sections (only on promos). Each component shows the
             child item's option groups in its own block. */}
          {components.map((c) => (
            <ComponentSection
              key={c.id}
              componentId={c.id}
              label={c.label}
              child={c.child}
              selections={selections[c.id] || {}}
              isGroupComplete={isGroupComplete}
              pulseRefKey={pulseRefKey}
              registerGroupRef={(groupId, el) => { groupRefs.current[`${c.id}__${groupId}`] = el; }}
              onToggle={(groupId, optName, group) => toggleOption(c.id, groupId, optName, group)}
            />
          ))}

          {/* Special instructions / notes */}
          <div className="mt-4">
            <h3 className="text-sm font-bold text-text mb-2">Instrucciones especiales</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              placeholder="Ej: sin cebolla, bien cocido, extra queso..."
              rows={2}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
            />
            <div className="text-right text-[10px] text-text-muted mt-0.5">
              {note.length}/{MAX_NOTE_LENGTH}
            </div>
          </div>
        </div>

        {/* Footer: quantity + add button (sticky — pinned bottom regardless of scroll) */}
        <div className="shrink-0 border-t border-border/50 bg-white px-5 py-4 space-y-3">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
            </button>
            <span className="text-lg font-bold text-text w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
          </div>

          <button
            onClick={handleAdd}
            // Intentionally NOT disabled — we want the click to scroll-to-missing
            // instead of silently doing nothing. Visual disabled state via styling.
            className={`w-full rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all flex items-center justify-between ${
              allRequiredMet
                ? "bg-gradient-to-r from-primary to-amber-500 shadow-primary/25 hover:shadow-lg"
                : "bg-slate-400 shadow-slate-400/20 hover:bg-slate-500"
            }`}
          >
            <span>{allRequiredMet ? "Agregar al pedido" : "Completá las opciones"}</span>
            <span>${totalPrice.toLocaleString("es-AR")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** One section per promo component: heading + child's option groups. Purely a
 * presentational wrapper that delegates each group to OptionGroupBlock. */
function ComponentSection({
  componentId,
  label,
  child,
  selections,
  isGroupComplete,
  pulseRefKey,
  registerGroupRef,
  onToggle,
}: {
  componentId: string;
  label: string;
  child: MenuItemData;
  selections: Record<string, Set<string>>;
  isGroupComplete: (surface: string, g: OptionGroupData) => boolean;
  pulseRefKey: string | null;
  registerGroupRef: (groupId: string, el: HTMLDivElement | null) => void;
  onToggle: (groupId: string, optionName: string, group: OptionGroupData) => void;
}) {
  const groups = child.optionGroups || [];

  return (
    <div className="mt-5 rounded-xl border border-border/50 bg-slate-50/50 p-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Slot
        </span>
        <h3 className="text-sm font-bold text-text">{label}</h3>
        {label !== child.name && (
          <span className="text-[11px] text-text-muted">({child.name})</span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="text-[11px] text-text-muted italic">Este item no tiene opciones para personalizar.</p>
      ) : (
        groups.map((g) => {
          const refKey = `${componentId}__${g.id}`;
          return (
            <OptionGroupBlock
              key={refKey}
              group={g}
              selected={selections[g.id] || new Set()}
              complete={isGroupComplete(componentId, g)}
              pulse={pulseRefKey === refKey}
              registerRef={(el) => registerGroupRef(g.id, el)}
              onToggle={(optName) => onToggle(g.id, optName, g)}
            />
          );
        })
      )}
    </div>
  );
}

/**
 * Single option-group block — extracted so it can be rendered once per
 * component in a multi-component promo. Purely presentational; all state
 * lives in the parent.
 *
 * Visual states:
 *   - Required + incomplete  → amber left border, "Obligatorio" badge
 *   - Required + complete    → emerald left border, "✓ Listo" tag
 *   - Optional               → no border accent
 *   - Pulse (just scrolled-to) → animated background flash for ~1.2s
 */
function OptionGroupBlock({
  group,
  selected,
  complete,
  pulse,
  registerRef,
  onToggle,
}: {
  group: OptionGroupData;
  selected: Set<string>;
  complete: boolean;
  pulse: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onToggle: (optionName: string) => void;
}) {
  const isRequired = group.minSelections > 0;
  const isIncomplete = isRequired && !complete;

  return (
    <div
      ref={registerRef}
      className={`mt-4 rounded-xl border-l-4 transition-all pl-3 -ml-3 ${
        isIncomplete
          ? "border-amber-500"
          : isRequired
            ? "border-emerald-500"
            : "border-transparent"
      } ${pulse ? "animate-pulse bg-amber-50" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-bold text-text">{group.title}</h4>
        {isRequired && (
          isIncomplete ? (
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              Obligatorio
            </span>
          ) : (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              ✓ Listo
            </span>
          )
        )}
        <span className="text-[10px] text-text-muted ml-auto">
          {selected.size}/{group.maxSelections}
        </span>
      </div>

      <div className="space-y-1.5">
        {group.options.filter((o) => o.available).map((o) => {
          const isSelected = selected.has(o.name);
          const isRadio = group.maxSelections === 1;
          const atMax = !isRadio && selected.size >= group.maxSelections && !isSelected;

          return (
            <button
              key={o.id}
              onClick={() => !atMax && onToggle(o.name)}
              disabled={atMax}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : atMax
                    ? "border-border/30 bg-slate-50 opacity-50"
                    : "border-border/60 hover:border-primary/40"
              }`}
            >
              <div className={`h-5 w-5 rounded-${isRadio ? "full" : "md"} border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? "border-primary bg-primary" : "border-border"
              }`}>
                {isSelected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>

              <span className={`text-sm flex-1 ${isSelected ? "font-semibold text-text" : "text-text-secondary"}`}>
                {o.name}
              </span>

              {o.priceDelta > 0 && (
                <span className="text-xs text-text-muted shrink-0">+${o.priceDelta.toLocaleString("es-AR")}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
