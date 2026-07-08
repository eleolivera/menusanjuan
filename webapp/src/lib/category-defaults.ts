// Fallback images used when a menu item has no `imageUrl` set but its parent
// category name matches a known default. Resolved server-side in
// `get-restaurant-menu.ts` so every downstream renderer (public storefront,
// customize sheet, cart, POS) sees a filled-in URL and doesn't have to know
// about the fallback logic.
//
// Add new mappings here whenever there's a shared, on-brand generic image
// worth reusing across restas. Keep the URL under `defaults/` on R2 so the
// asset stays in one predictable folder.
//
// Lookup is case-insensitive on category name; accents preserved verbatim
// because MenuCategory.name IS accented in the data ("Papas Fritas").

const R2 = "https://images.menusanjuan.com/defaults";

const CATEGORY_DEFAULTS: Record<string, string> = {
  // Long panini-style sandwiches — the resta's signature category.
  pachatas: `${R2}/pachata.jpg`,
  pachata: `${R2}/pachata.jpg`,
  // Argentine lomo (steak sandwich, often w/ ham+cheese+egg).
  lomos: `${R2}/lomo.jpg`,
  lomo: `${R2}/lomo.jpg`,
  // Round burgers (brioche or pan-de-papa). Two common naming conventions
  // in San Juan — cover both so we don't miss.
  burgers: `${R2}/burger.jpg`,
  burger: `${R2}/burger.jpg`,
  hamburguesas: `${R2}/burger.jpg`,
  hamburguesa: `${R2}/burger.jpg`,
  // Fries. Cover the plain and the "papas grandes" naming.
  "papas fritas": `${R2}/papas.jpg`,
  papas: `${R2}/papas.jpg`,
  "papas grandes": `${R2}/papas.jpg`,
};

export function defaultImageForCategory(categoryName: string): string | null {
  return CATEGORY_DEFAULTS[categoryName.trim().toLowerCase()] ?? null;
}
