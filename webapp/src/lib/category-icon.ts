import type { ComponentType } from "react";
import {
  // Phosphor has actual FOOD-shaped icons that Lucide doesn't ship — Hamburger,
  // Pizza, BowlFood, BowlSteam, Wine, BeerStein, Coffee, IceCream, etc. Use
  // these for category icons since the customer recognizes the shape instantly.
  Hamburger,
  Pizza,
  BowlFood,
  BowlSteam,
  Wine,
  BeerStein,
  Coffee,
  IceCream,
  Cake,
  Cookie,
  Egg,
  Bread,
  Sparkle,
  Tag,
  Orange,
  Fish,
  Carrot,
  ForkKnife,
  Pepper,
} from "@phosphor-icons/react";
import {
  // Lucide fills the gaps Phosphor doesn't cover well (Sandwich, Drumstick,
  // Salad, Apple-the-fruit-not-the-brand) and provides the fallback cutlery.
  Sandwich,
  Drumstick,
  Salad,
  Apple,
  UtensilsCrossed,
} from "lucide-react";

/** Both Phosphor and Lucide icons accept `className` for sizing/coloring via
 * Tailwind, plus other SVG passthroughs. We type with SVGProps so callers can
 * still pass things like strokeWidth — Phosphor uses `weight` instead but its
 * underlying SVG ignores unknown attrs gracefully, so passing strokeWidth to
 * a Phosphor icon is a no-op (not a crash). */
import type { SVGProps } from "react";
export type CategoryIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Maps a category name to a polished food icon. Substring + regex matching is
 * case-insensitive. Order matters — more specific terms first so they win over
 * generic ones (e.g. "café" before any "co" prefix).
 *
 * To add a category mapping later, drop a `{ match, icon }` pair in RULES.
 * The fallback is a generic cutlery mark so no category ever renders without
 * an icon.
 */
const RULES: { match: RegExp; icon: CategoryIcon }[] = [
  // Promos / specials / featured — the "deal" feel
  { match: /\bpromo|combo|oferta|descuent|destacad/i, icon: Sparkle },
  { match: /\bespecial/i, icon: Tag },

  // Burgers — the defining win of Phosphor over Lucide here
  { match: /\b(hambur|burger|smashed)/i, icon: Hamburger },

  // Sandwich-family — pachatas, piadinas, lomos, choripán, milanesas, tostado
  { match: /\b(pachat|piadin|lomo|chori|milan|sandwich|panchos?|hot.?dogs?|wrap|tostado|pebete|sub)/i, icon: Sandwich },

  // Pizza
  { match: /\bpizz/i, icon: Pizza },

  // Pasta / Italian / noodles → bowl of food
  { match: /\b(past|fideo|ñoqu|raviol|sorrent|lasaña|canelon|tallar|noodle|ramen)/i, icon: BowlFood },

  // Salads / veggie / healthy
  { match: /\b(ensalad|verdur|veggi|vegan|saluda|light)/i, icon: Salad },

  // Soups / stews — steaming bowl
  { match: /\b(sopa|caldo|guiso|locro|cazuela|crema)/i, icon: BowlSteam },

  // Chicken / poultry
  { match: /\b(pollo|aves?|alit)/i, icon: Drumstick },

  // Meat / parrilla / asado
  { match: /\b(parrill|asad|carne|bife|chivito|costill|achura|mollej)/i, icon: ForkKnife },

  // Fish / seafood
  { match: /\b(pescad|fish|mariscos?|cami|atun|salmon)/i, icon: Fish },

  // Sides / fries / acompañamientos — generic bowl of food
  { match: /\b(acompañ|guarnic|fritas?|papas?|side)/i, icon: BowlFood },

  // Empanadas / pastries / bakery — bread / pastry
  { match: /\b(empan|factur|medialun|croissant|panad|bollería|pan)/i, icon: Bread },

  // Eggs / breakfast
  { match: /\b(huev|desayun|brunch|breakfast)/i, icon: Egg },

  // Desserts
  { match: /\b(postr|dulc|torta|cake|brownie|cheesecake|tiramis)/i, icon: Cake },
  { match: /\b(cookie|galleta)/i, icon: Cookie },
  { match: /\b(helad|nieve|sorbete|ice.?cream)/i, icon: IceCream },

  // Drinks — coffee first, then juices, then sodas, then alcohol
  { match: /\b(café|cafe|capuchin|latte|espresso|americano|moka)/i, icon: Coffee },
  { match: /\b(jugo|exprimido|smoothie|licuad|batido|frapp)/i, icon: Orange },
  { match: /\b(bebida|gaseos|refresc|agua|soda|limonada|cola|sprite|fanta)/i, icon: Orange },
  { match: /\b(cerveza|chopp|ipa|lager|stout|beer)/i, icon: BeerStein },
  { match: /\b(vino|wine|champ|spuman|prosecc|sangr|fernet|gin|whisky|trago|cocktail|aperit)/i, icon: Wine },

  // Spicy / picante
  { match: /\b(picant|spicy|hot)/i, icon: Pepper },

  // Fruits
  { match: /\b(fruta|manzan|apple|pera|uva|banan)/i, icon: Apple },
  { match: /\b(naranj|cítric|orange|lim[oó]n)/i, icon: Orange },

  // Vegetables / vegetal
  { match: /\b(zanahor|carrot|vegetal)/i, icon: Carrot },
];

const DEFAULT_ICON: CategoryIcon = UtensilsCrossed;

export function getCategoryIcon(name: string): CategoryIcon {
  for (const rule of RULES) {
    if (rule.match.test(name)) return rule.icon;
  }
  return DEFAULT_ICON;
}
