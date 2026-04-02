import { prisma } from "./prisma";
import type { MenuCategoryData } from "@/data/menus";

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
            include: { options: { orderBy: { sortOrder: "asc" } } },
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
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      imageUrl: item.imageUrl || "",
      badge: item.badge || undefined,
      rating: item.rating || undefined,
      available: item.available,
      optionGroups: item.optionGroups.map((g) => ({
        id: g.id,
        title: g.title,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: o.priceDelta,
          available: o.available,
        })),
      })),
    })),
  }));
}
