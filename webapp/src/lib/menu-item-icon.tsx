// Placeholder icon + tinted background for menu items that lack an imageUrl.
// Picks a Phosphor icon by category first (Nono Luis's 6 categories map
// cleanly), then by item-name keyword (pizza, cerveza, etc.), then a
// generic ForkKnife.
//
// Returned shape lets the caller compose the placeholder any way it wants:
//   <div className={`bg ${bgClass}`}><Icon className={iconClass} /></div>

import {
  Drop,
  Cookie,
  Nut,
  Wine,
  BeerBottle,
  Grains,
  Package,
  Pizza,
  Hamburger,
  Coffee,
  Bread,
  Cake,
  IceCream,
  Fish,
  Egg,
  Cherries,
  Popcorn,
  Popsicle,
  Carrot,
  BowlFood,
  ForkKnife,
  type Icon,
} from "@phosphor-icons/react";

type IconSpec = { Icon: Icon; bgClass: string; iconClass: string };

const CATEGORY_MAP: Array<{ match: RegExp; spec: IconSpec }> = [
  { match: /miel/i,                spec: { Icon: Drop,      bgClass: "bg-amber-100",  iconClass: "text-amber-600" } },
  { match: /dulces?|mermelada/i,   spec: { Icon: Cookie,    bgClass: "bg-rose-100",   iconClass: "text-rose-600" } },
  { match: /frutos? secos?/i,      spec: { Icon: Nut,       bgClass: "bg-orange-100", iconClass: "text-orange-700" } },
  { match: /aceite|conserva|vino/i,spec: { Icon: Wine,      bgClass: "bg-lime-100",   iconClass: "text-lime-700" } },
  { match: /cereal/i,              spec: { Icon: Grains,    bgClass: "bg-stone-100",  iconClass: "text-stone-700" } },
  { match: /variados?/i,           spec: { Icon: Package,   bgClass: "bg-slate-100",  iconClass: "text-slate-600" } },
  { match: /pizza/i,               spec: { Icon: Pizza,     bgClass: "bg-red-100",    iconClass: "text-red-600" } },
  { match: /hamburgues|burger/i,   spec: { Icon: Hamburger, bgClass: "bg-amber-100",  iconClass: "text-amber-700" } },
  { match: /pescado|mariscos?/i,   spec: { Icon: Fish,      bgClass: "bg-sky-100",    iconClass: "text-sky-600" } },
  { match: /caf[eé]/i,             spec: { Icon: Coffee,    bgClass: "bg-amber-100",  iconClass: "text-amber-800" } },
  { match: /pan(es)?|panader/i,    spec: { Icon: Bread,     bgClass: "bg-amber-100",  iconClass: "text-amber-700" } },
  { match: /torta|postre/i,        spec: { Icon: Cake,      bgClass: "bg-pink-100",   iconClass: "text-pink-600" } },
  { match: /helado/i,              spec: { Icon: IceCream,  bgClass: "bg-cyan-100",   iconClass: "text-cyan-600" } },
  { match: /verduras?|ensalada/i,  spec: { Icon: Carrot,    bgClass: "bg-emerald-100", iconClass: "text-emerald-600" } },
];

const KEYWORD_MAP: Array<{ match: RegExp; spec: IconSpec }> = [
  { match: /\bmiel\b/i,              spec: { Icon: Drop,      bgClass: "bg-amber-100",  iconClass: "text-amber-600" } },
  { match: /\bcerveza\b|beer/i,      spec: { Icon: BeerBottle,bgClass: "bg-amber-100",  iconClass: "text-amber-700" } },
  { match: /\bvino\b/i,              spec: { Icon: Wine,      bgClass: "bg-purple-100", iconClass: "text-purple-700" } },
  { match: /\bcaf[eé]\b/i,           spec: { Icon: Coffee,    bgClass: "bg-amber-100",  iconClass: "text-amber-800" } },
  { match: /\bpan\b/i,               spec: { Icon: Bread,     bgClass: "bg-amber-100",  iconClass: "text-amber-700" } },
  { match: /\btorta\b|\bpostre\b/i,  spec: { Icon: Cake,      bgClass: "bg-pink-100",   iconClass: "text-pink-600" } },
  { match: /\bhuevo\b|\bhuevos\b/i,  spec: { Icon: Egg,       bgClass: "bg-yellow-100", iconClass: "text-yellow-700" } },
  { match: /helado/i,                spec: { Icon: IceCream,  bgClass: "bg-cyan-100",   iconClass: "text-cyan-600" } },
  { match: /pochoclo|palomit/i,      spec: { Icon: Popcorn,   bgClass: "bg-yellow-100", iconClass: "text-yellow-700" } },
  { match: /paleta|helado en palito/i, spec: { Icon: Popsicle, bgClass: "bg-cyan-100",  iconClass: "text-cyan-600" } },
  { match: /nuez|almendra|man[ií]|semilla|pistacho|dátil|coco|dulce de leche/i,
                                      spec: { Icon: Nut,       bgClass: "bg-orange-100", iconClass: "text-orange-700" } },
  { match: /frutilla|cerez|mora|frutos rojos/i,
                                      spec: { Icon: Cherries,  bgClass: "bg-rose-100",   iconClass: "text-rose-600" } },
  { match: /pescado|salm[oó]n|at[uú]n/i,
                                      spec: { Icon: Fish,      bgClass: "bg-sky-100",    iconClass: "text-sky-600" } },
];

const DEFAULT_SPEC: IconSpec = {
  Icon: ForkKnife,
  bgClass: "bg-slate-100",
  iconClass: "text-slate-500",
};

const BOWL_SPEC: IconSpec = {
  Icon: BowlFood,
  bgClass: "bg-orange-100",
  iconClass: "text-orange-700",
};

/**
 * Pick a placeholder icon for a menu item. Category name is optional (some
 * callers only have the item in hand); when provided it wins because
 * "MIEL BLANCA PLASTICO" has no honey keyword in the name — the category
 * "Miel" is the signal.
 */
export function iconForItem(itemName: string, categoryName?: string): IconSpec {
  if (categoryName) {
    for (const { match, spec } of CATEGORY_MAP) {
      if (match.test(categoryName)) return spec;
    }
  }
  for (const { match, spec } of KEYWORD_MAP) {
    if (match.test(itemName)) return spec;
  }
  // If the item looks like a "plato" (mesa, guiso, milanesa, etc.) prefer
  // the BowlFood icon over generic cutlery.
  if (/milanesa|guiso|est[oó]fado|plato|arroz|pastas?|fideos?/i.test(itemName)) return BOWL_SPEC;
  return DEFAULT_SPEC;
}
