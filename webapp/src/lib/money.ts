// Pure money math helpers — no DB imports, safe for client + server

export type CartLineLike = {
  unitPrice?: number;
  priceOverride?: number | null;
  optionsDelta?: number | null;
  quantity: number;
};

/** Compute the unit price for a single line, respecting price overrides and option deltas. */
export function lineUnitPrice(item: { unitPrice?: number; priceOverride?: number | null; optionsDelta?: number | null }): number {
  if (item.priceOverride !== undefined && item.priceOverride !== null) return item.priceOverride;
  return (item.unitPrice ?? 0) + (item.optionsDelta ?? 0);
}

/** Compute the total for a single line (unit * quantity), rounded to whole pesos. */
export function lineTotal(item: CartLineLike): number {
  return Math.round(lineUnitPrice(item) * item.quantity);
}

/** Compute the total of all items in a cart, rounded to whole pesos. */
export function computeCartTotal(items: CartLineLike[]): number {
  return Math.round(items.reduce((sum, it) => sum + lineUnitPrice(it) * it.quantity, 0));
}
