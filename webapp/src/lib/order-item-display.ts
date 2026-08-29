// Display helpers for order items — pure formatting, no DB deps.
//
// Since the variable-pricing rollout, an order item's on-screen "quantity"
// column depends on its pricingMode:
//   FIXED     — "3×"   (integer × count)
//   PACKAGED  — "2× ¼ kg"   (jarCount + tierLabel)
//   BY_WEIGHT — "0,5 kg"  (weight + unit, es-AR locale)
//
// Every display surface (Kanban card, ticket, ESC/POS, mis-pedidos, email,
// driver page, POS re-open list, WhatsApp copy-items builder) funnels through
// this helper so a swap here fixes them all.

type ItemLike = {
  quantity: number;
  pricingMode?: "FIXED" | "PACKAGED" | "BY_WEIGHT";
  tierLabel?: string;
  weight?: number;
  weightUnit?: string;
};

/**
 * Format the "how much" column for an order item. Always ends in a space
 * before the item name (e.g. "2× ¼ kg " + "Miel Blanca").
 */
export function formatItemQuantity(item: ItemLike): string {
  const mode = item.pricingMode ?? "FIXED";

  if (mode === "BY_WEIGHT") {
    const w = item.weight ?? item.quantity ?? 0;
    const u = item.weightUnit ?? "kg";
    return `${formatFraction(w)} ${u}`;
  }

  if (mode === "PACKAGED" && item.tierLabel) {
    return item.quantity > 1
      ? `${item.quantity}× ${item.tierLabel}`
      : `${item.tierLabel}`;
  }

  return `${item.quantity}×`;
}

/**
 * Format an amount for BY_WEIGHT display. Uses es-AR conventions (comma as
 * decimal), trims trailing zeros so 1.0 → "1", 0.5 → "0,5", 0.25 → "0,25".
 */
export function formatFraction(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  const s = rounded.toString();
  // Prefer the native es-AR formatter for cleaner locale output; falls back
  // to string replace in edge cases.
  try {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }).format(rounded);
  } catch {
    return s.replace(".", ",");
  }
}
