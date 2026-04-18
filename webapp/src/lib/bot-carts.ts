/**
 * localStorage-based cart storage for the public bot.
 * Each cart represents a pending order at a restaurant.
 */

export type BotCart = {
  slug: string;
  restaurantName: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  checkoutUrl: string;
  createdAt: string; // ISO
};

const STORAGE_KEY = "msj_bot_carts";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

export function getBotCarts(): BotCart[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const carts: BotCart[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh = carts.filter((c) => new Date(c.createdAt).getTime() > cutoff);
    if (fresh.length !== carts.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
    return fresh;
  } catch {
    return [];
  }
}

export function saveBotCart(cart: Omit<BotCart, "createdAt">): void {
  if (typeof window === "undefined") return;
  const carts = getBotCarts();
  // Replace if same restaurant, otherwise add
  const existing = carts.findIndex((c) => c.slug === cart.slug);
  const entry: BotCart = { ...cart, createdAt: new Date().toISOString() };
  if (existing >= 0) {
    carts[existing] = entry;
  } else {
    carts.unshift(entry);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carts.slice(0, 10)));
  } catch {}
}

export function removeBotCart(slug: string): void {
  if (typeof window === "undefined") return;
  const carts = getBotCarts().filter((c) => c.slug !== slug);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carts));
  } catch {}
}
