import {
  Sandwich,
  Pizza,
  Beef,
  IceCream,
  Coffee,
  CupSoda,
  Wine,
  Beer,
  Cake,
  Cookie,
  Salad,
  Soup,
  Drumstick,
  Croissant,
  Egg,
  Carrot,
  Apple,
  Sparkles,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Map a category name to a polished Lucide icon. Falls back to a generic
 * "cutlery" mark when no rule matches, so the customer-facing nav looks
 * consistent regardless of what emoji the owner originally picked.
 *
 * Matching is case-insensitive and substring-based (e.g. "Hamburguesas
 * clásicas" still resolves to the burger icon via "hamb"). Rules are checked
 * in order — put more specific terms FIRST so they win over generic ones
 * (e.g. "café" before "co" or "helado" before "ado").
 *
 * If you need to add a new mapping, drop a `{ match, icon }` pair in the
 * RULES array. The order matters; more specific first.
 */
const RULES: { match: RegExp; icon: LucideIcon }[] = [
  // Promos / specials / featured
  { match: /\bpromo|combo|oferta|destacad/i, icon: Sparkles },
  { match: /\bespecial/i, icon: Tag },

  // Sandwich-family — pachatas, piadinas, lomos, choripán, milanesas
  { match: /\b(pachat|piadin|lomo|chori|milan|sandwich|panchos?|hot.?dogs?|wrap|sandwich|tostado|pebete)/i, icon: Sandwich },

  // Burgers
  { match: /\b(hambur|burger|smashed)/i, icon: Beef },

  // Pizza
  { match: /\bpizz/i, icon: Pizza },

  // Pasta / italian
  { match: /\b(past|fideo|ñoqu|raviol|sorrent|lasaña|canelon|tallar)/i, icon: UtensilsCrossed },

  // Salads / veggie / healthy
  { match: /\b(ensalad|verdur|veggi|vegan|saluda|light)/i, icon: Salad },

  // Soups / stews
  { match: /\b(sopa|caldo|guiso|locro|cazuela|crema)/i, icon: Soup },

  // Meat / parrilla / chicken
  { match: /\b(parrill|asad|carne|bife|chivito)/i, icon: Beef },
  { match: /\b(pollo|aves?|alit)/i, icon: Drumstick },

  // Sides / acompañamientos / fries
  { match: /\b(acompañ|guarnic|fritas?|papas?|side)/i, icon: Carrot },

  // Pastries / bakery
  { match: /\b(facturas?|medialun|croissant|panad|bollería)/i, icon: Croissant },
  { match: /\b(empan)/i, icon: Croissant },

  // Eggs / breakfast
  { match: /\b(huev|desayun|brunch|breakfast)/i, icon: Egg },

  // Desserts
  { match: /\b(postr|dulc|torta|cake|brownie|cheesecake|tiramis)/i, icon: Cake },
  { match: /\b(cookie|galleta)/i, icon: Cookie },
  { match: /\b(helad|nieve|sorbete|ice.?cream)/i, icon: IceCream },

  // Drinks — coffee first, then juices, then sodas, then alcohol
  { match: /\b(café|cafe|capuchin|latte|espresso|americano)/i, icon: Coffee },
  { match: /\b(jugo|exprimido|smoothie|licuad|batido|frapp)/i, icon: CupSoda },
  { match: /\b(bebida|gaseos|refresc|agua|soda|limonada|cola|sprite|fanta)/i, icon: CupSoda },
  { match: /\b(cerveza|chopp|ipa|lager|stout|beer)/i, icon: Beer },
  { match: /\b(vino|wine|champ|spuman|prosecc|sangr|fernet|gin|whisky|trago)/i, icon: Wine },

  // Fruits
  { match: /\b(fruta|manzan|apple|naranj|orange|banan|pera|uva)/i, icon: Apple },
];

const DEFAULT_ICON: LucideIcon = UtensilsCrossed;

export function getCategoryIcon(name: string): LucideIcon {
  for (const rule of RULES) {
    if (rule.match.test(name)) return rule.icon;
  }
  return DEFAULT_ICON;
}
