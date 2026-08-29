// Placeholder icon + tinted background for menu items that lack an imageUrl.
// Picks an Iconoir icon by category first (Nono Luis's 6 categories map
// cleanly), then by item-name keyword (pizza, cerveza, etc.), then a
// generic OrganicFood fallback.
//
// Returned shape lets the caller compose the placeholder any way it wants:
//   <div className={`bg ${bgClass}`}><Icon className={iconClass} /></div>

import {
  Droplet,
  Cookie,
  OrganicFood,
  OrganicFoodSquare,
  GlassHalf,
  Farm,
  Package,
  PizzaSlice,
  CoffeeCup,
  BreadSlice,
  IceCream,
  Fish,
  Egg,
  Leaf,
  Chocolate,
  OrangeSlice,
} from "iconoir-react";
import type { ComponentType, SVGProps } from "react";

type IconLike = ComponentType<SVGProps<SVGSVGElement>>;
type IconSpec = { Icon: IconLike; bgClass: string; iconClass: string };

const CATEGORY_MAP: Array<{ match: RegExp; spec: IconSpec }> = [
  { match: /miel/i,                spec: { Icon: Droplet,           bgClass: "bg-amber-100",   iconClass: "text-amber-600" } },
  { match: /dulces?|mermelada/i,   spec: { Icon: Cookie,            bgClass: "bg-rose-100",    iconClass: "text-rose-600" } },
  { match: /frutos? secos?/i,      spec: { Icon: OrganicFood,       bgClass: "bg-orange-100",  iconClass: "text-orange-700" } },
  { match: /aceite|conserva|vino/i,spec: { Icon: GlassHalf,         bgClass: "bg-lime-100",    iconClass: "text-lime-700" } },
  { match: /cereal/i,              spec: { Icon: OrganicFoodSquare, bgClass: "bg-stone-100",   iconClass: "text-stone-700" } },
  { match: /varios|productos/i,    spec: { Icon: Package,           bgClass: "bg-slate-100",   iconClass: "text-slate-600" } },
  { match: /pizza/i,               spec: { Icon: PizzaSlice,        bgClass: "bg-red-100",     iconClass: "text-red-600" } },
  { match: /pescado|mariscos?/i,   spec: { Icon: Fish,              bgClass: "bg-sky-100",     iconClass: "text-sky-600" } },
  { match: /caf[eé]/i,             spec: { Icon: CoffeeCup,         bgClass: "bg-amber-100",   iconClass: "text-amber-800" } },
  { match: /pan(es)?|panader/i,    spec: { Icon: BreadSlice,        bgClass: "bg-amber-100",   iconClass: "text-amber-700" } },
  { match: /torta|postre/i,        spec: { Icon: Chocolate,         bgClass: "bg-pink-100",    iconClass: "text-pink-600" } },
  { match: /helado/i,              spec: { Icon: IceCream,          bgClass: "bg-cyan-100",    iconClass: "text-cyan-600" } },
  { match: /verduras?|ensalada/i,  spec: { Icon: Leaf,              bgClass: "bg-emerald-100", iconClass: "text-emerald-600" } },
];

const KEYWORD_MAP: Array<{ match: RegExp; spec: IconSpec }> = [
  { match: /\bmiel\b/i,             spec: { Icon: Droplet,   bgClass: "bg-amber-100",  iconClass: "text-amber-600" } },
  { match: /\bvino\b/i,             spec: { Icon: GlassHalf, bgClass: "bg-purple-100", iconClass: "text-purple-700" } },
  { match: /\bcaf[eé]\b/i,          spec: { Icon: CoffeeCup, bgClass: "bg-amber-100",  iconClass: "text-amber-800" } },
  { match: /\bpan\b/i,              spec: { Icon: BreadSlice, bgClass: "bg-amber-100", iconClass: "text-amber-700" } },
  { match: /\btorta\b|\bpostre\b|chocolate|dulce de leche/i,
                                    spec: { Icon: Chocolate, bgClass: "bg-pink-100",   iconClass: "text-pink-600" } },
  { match: /\bhuevo\b|\bhuevos\b/i, spec: { Icon: Egg,       bgClass: "bg-yellow-100", iconClass: "text-yellow-700" } },
  { match: /helado/i,               spec: { Icon: IceCream,  bgClass: "bg-cyan-100",   iconClass: "text-cyan-600" } },
  { match: /naranja|mandarina|c[ií]trico/i,
                                    spec: { Icon: OrangeSlice, bgClass: "bg-orange-100", iconClass: "text-orange-600" } },
  { match: /nuez|almendra|man[ií]|pistacho|d[aá]til|coco|semilla/i,
                                    spec: { Icon: OrganicFood, bgClass: "bg-orange-100", iconClass: "text-orange-700" } },
  { match: /pescado|salm[oó]n|at[uú]n/i,
                                    spec: { Icon: Fish,      bgClass: "bg-sky-100",    iconClass: "text-sky-600" } },
  { match: /aceite|oliva/i,         spec: { Icon: GlassHalf, bgClass: "bg-lime-100",   iconClass: "text-lime-700" } },
];

const DEFAULT_SPEC: IconSpec = {
  Icon: OrganicFood,
  bgClass: "bg-slate-100",
  iconClass: "text-slate-500",
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
  return DEFAULT_SPEC;
}
