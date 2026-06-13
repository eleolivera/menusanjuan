import { prisma } from "./prisma";
import type { MenuCategoryData, MenuItemData, OptionGroupData } from "@/data/menus";

/**
 * Flatten Prisma OptionGroup rows (with their preset / inline options) into
 * the public-facing OptionGroupData shape. Used both for top-level items and
 * for child items inside a promo's components.
 *
 * Filters out orphaned groups (preset deleted, inline empty) so the customer
 * isn't forced into a required-but-empty selection on checkout.
 */
function flattenOptionGroups(
  groups: {
    id: string;
    title: string;
    minSelections: number;
    maxSelections: number;
    options: { id: string; name: string; priceDelta: number; available: boolean; sortOrder: number }[];
    preset: { options: { id: string; name: string; priceDelta: number; available: boolean }[] } | null;
  }[],
): OptionGroupData[] {
  return groups
    .map((g) => {
      const resolvedOptions = g.preset
        ? g.preset.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available }))
        : g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available }));
      return {
        id: g.id,
        title: g.title,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        options: resolvedOptions,
      };
    })
    .filter((g) => g.options.length > 0);
}

/** Convert a Prisma item row (with optionGroups loaded) → MenuItemData.
 * `components` are intentionally NOT included here; the parent caller attaches
 * them in a second pass to avoid recursive includes blowing up the query. */
function mapItemBase(item: {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  badge: string | null;
  rating: number | null;
  available: boolean;
  optionGroups: Parameters<typeof flattenOptionGroups>[0];
}): MenuItemData {
  return {
    id: item.id,
    name: item.name,
    description: item.description || "",
    price: item.price,
    imageUrl: item.imageUrl || "",
    badge: item.badge || undefined,
    rating: item.rating || undefined,
    available: item.available,
    optionGroups: flattenOptionGroups(item.optionGroups),
  };
}

export async function getMenuBySlug(slug: string): Promise<MenuCategoryData[]> {
  const dealer = await prisma.dealer.findUnique({ where: { slug } });
  if (!dealer) return [];

  const dbCategories = await prisma.menuCategory.findMany({
    where: { dealerId: dealer.id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          optionGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              preset: { include: { options: { orderBy: { sortOrder: "asc" } } } },
            },
          },
          // Promo components: each component points to a child MenuItem that
          // brings its own option groups. We include the child + its option
          // groups one level deep — combos-inside-combos aren't supported.
          componentsOf: {
            orderBy: { sortOrder: "asc" },
            include: {
              childItem: {
                include: {
                  optionGroups: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                      options: { orderBy: { sortOrder: "asc" } },
                      preset: { include: { options: { orderBy: { sortOrder: "asc" } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return dbCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    emoji: cat.emoji || "🍽️",
    items: cat.items.map((item) => {
      const base = mapItemBase(item);
      if (item.componentsOf.length === 0) return base;
      // Attach components — each references a fully-resolved child item so the
      // customize sheet can render the child's option groups inline.
      return {
        ...base,
        components: item.componentsOf.map((c) => ({
          id: c.id,
          childItemId: c.childItemId,
          label: c.label || c.childItem.name,
          sortOrder: c.sortOrder,
          child: mapItemBase(c.childItem),
        })),
      };
    }),
  }));
}
