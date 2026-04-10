/**
 * localStorage-based order tracking for anonymous customers.
 * Stores order references per restaurant slug.
 */

export type OrderRef = {
  orderId: string;
  token: string;
  orderNumber: string;
  placedAt: string; // ISO string
};

const MAX_REFS_PER_SLUG = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getKey(slug: string): string {
  return `msj_orders_${slug}`;
}

export function saveOrderRef(slug: string, orderId: string, token: string, orderNumber: string): void {
  if (typeof window === "undefined") return;
  const refs = getOrderRefs(slug);
  refs.unshift({ orderId, token, orderNumber, placedAt: new Date().toISOString() });
  // Keep only the most recent
  const trimmed = refs.slice(0, MAX_REFS_PER_SLUG);
  try {
    localStorage.setItem(getKey(slug), JSON.stringify(trimmed));
  } catch {}
}

export function getOrderRefs(slug: string): OrderRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getKey(slug));
    if (!raw) return [];
    const refs: OrderRef[] = JSON.parse(raw);
    // Prune stale entries
    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh = refs.filter((r) => new Date(r.placedAt).getTime() > cutoff);
    if (fresh.length !== refs.length) {
      localStorage.setItem(getKey(slug), JSON.stringify(fresh));
    }
    return fresh;
  } catch {
    return [];
  }
}

export function getLatestOrderRef(slug: string): OrderRef | null {
  const refs = getOrderRefs(slug);
  return refs[0] || null;
}

export function removeOrderRef(slug: string, orderId: string): void {
  if (typeof window === "undefined") return;
  const refs = getOrderRefs(slug).filter((r) => r.orderId !== orderId);
  try {
    localStorage.setItem(getKey(slug), JSON.stringify(refs));
  } catch {}
}
