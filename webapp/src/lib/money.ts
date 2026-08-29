// Pure money math helpers — no DB imports, safe for client + server.
//
// Since the variable-pricing rollout, these helpers switch on `pricingMode`:
//   FIXED     — legacy behavior. unit = (unitPrice + optionsDelta), total =
//               unit × quantity. Untouched for the 101 non-variable-pricing
//               restas.
//   PACKAGED  — unit = tierPrice (the price of ONE jar at the chosen tier).
//               quantity = jars of that tier. Options never apply to
//               packaged tiers today, so optionsDelta is ignored.
//   BY_WEIGHT — unit = pricePerUnit (from the highest matching tier for the
//               chosen weight). total = pricePerUnit × weight. quantity ==
//               weight for legacy display; authoritative value is `weight`.
//
// priceOverride still wins for POS "cortesía / precio especial" — matches
// existing semantics regardless of pricing mode.

export type QuantityTier =
  | { label: string; amount: number; price: number }              // PACKAGED
  | { fromAmount: number; pricePerUnit: number };                 // BY_WEIGHT

export type CartLineLike = {
  unitPrice?: number;
  priceOverride?: number | null;
  optionsDelta?: number | null;
  quantity: number;

  // Variable-pricing fields. When absent, we treat the line as FIXED.
  pricingMode?: "FIXED" | "PACKAGED" | "BY_WEIGHT";
  tierPrice?: number;    // PACKAGED: price of one jar at chosen tier
  weight?: number;       // BY_WEIGHT: actual weight in item's weightUnit
  quantityTiers?: unknown; // BY_WEIGHT lines carry the item's tier ladder
                           // so we can resolve the per-unit rate at total time.
                           // Optional — when absent we fall back to unitPrice
                           // as the per-unit rate.
};

/**
 * Given a BY_WEIGHT weight, find the applicable per-unit rate from the tier
 * ladder. Highest `fromAmount ≤ weight` wins. Falls back to the first tier if
 * weight is below any listed `fromAmount`.
 */
function perUnitRateForWeight(tiers: unknown, weight: number, fallback: number): number {
  if (!Array.isArray(tiers) || tiers.length === 0) return fallback;
  let applicable: number | null = null;
  let bestFrom = -Infinity;
  for (const t of tiers as Array<{ fromAmount?: number; pricePerUnit?: number }>) {
    const from = Number(t?.fromAmount);
    const rate = Number(t?.pricePerUnit);
    if (!Number.isFinite(from) || !Number.isFinite(rate)) continue;
    if (from <= weight && from >= bestFrom) {
      bestFrom = from;
      applicable = rate;
    }
  }
  return applicable ?? fallback;
}

/**
 * Compute the unit price for a single line. Respects priceOverride first, then
 * dispatches on pricingMode. Result is "price per unit of `quantity`" — i.e.
 * per jar for PACKAGED, per weight-unit for BY_WEIGHT.
 */
export function lineUnitPrice(item: CartLineLike): number {
  if (item.priceOverride !== undefined && item.priceOverride !== null) return item.priceOverride;

  const mode = item.pricingMode ?? "FIXED";
  if (mode === "PACKAGED") {
    // If the line was persisted with a tier, use its price. Otherwise fall
    // back to the FIXED math so a mis-serialized order still reads sanely.
    if (item.tierPrice !== undefined && item.tierPrice !== null) return item.tierPrice;
    return (item.unitPrice ?? 0) + (item.optionsDelta ?? 0);
  }
  if (mode === "BY_WEIGHT") {
    const weight = item.weight ?? item.quantity ?? 0;
    return perUnitRateForWeight(item.quantityTiers, weight, item.unitPrice ?? 0);
  }
  // FIXED
  return (item.unitPrice ?? 0) + (item.optionsDelta ?? 0);
}

/**
 * Compute the total for a single line, rounded to whole pesos. Handles the
 * PACKAGED × jarCount and BY_WEIGHT × weight cases via lineUnitPrice.
 */
export function lineTotal(item: CartLineLike): number {
  const unit = lineUnitPrice(item);
  const mode = item.pricingMode ?? "FIXED";
  // BY_WEIGHT: total = per-unit × actual weight (which is what `quantity`
  // stores for compatibility, unless a separate `weight` is provided).
  const multiplier = mode === "BY_WEIGHT" ? (item.weight ?? item.quantity) : item.quantity;
  return Math.round(unit * multiplier);
}

/** Compute the total of all items in a cart, rounded to whole pesos. */
export function computeCartTotal(items: CartLineLike[]): number {
  return items.reduce((sum, it) => sum + lineTotal(it), 0);
}
