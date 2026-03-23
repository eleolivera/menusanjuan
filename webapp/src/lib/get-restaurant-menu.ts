import { prisma } from "./prisma";
import { DEMO_RESTAURANTS } from "@/data/restaurants";
import { getMenuForRestaurant as getDemoMenu } from "@/data/menus";
import type { MenuCategoryData } from "@/data/menus";

export async function getMenuBySlug(slug: string): Promise<MenuCategoryData[]> {
  // Check if it's a demo restaurant with hardcoded menu
  const isDemo = DEMO_RESTAURANTS.some((r) => r.slug === slug);

  // Try DB first
  const dealer = await prisma.dealer.findUnique({ where: { slug } });
  if (dealer) {
    const dbCategories = await prisma.menuCategory.findMany({
      where: { dealerId: dealer.id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });

    if (dbCategories.length > 0) {
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
        })),
      }));
    }
  }

  // Fall back to demo menu
  if (isDemo) {
    return getDemoMenu(slug);
  }

  // New restaurant with no menu yet
  return [];
}
