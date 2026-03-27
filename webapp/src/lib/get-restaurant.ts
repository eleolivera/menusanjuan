import { prisma } from "./prisma";
import type { Restaurant } from "@/data/restaurants";

export type RestaurantWithDealerId = Restaurant & { dealerId: string | null; isVerified: boolean; ownerUserId: string | null };

export async function getRestaurantBySlug(slug: string): Promise<RestaurantWithDealerId | null> {
  const dealer = await prisma.dealer.findUnique({
    where: { slug },
    include: {
      account: { select: { userId: true } },
      categories: { select: { _count: { select: { items: true } } } },
    },
  });

  if (!dealer) return null;

  const itemCount = dealer.categories.reduce((s, c) => s + c._count.items, 0);

  return {
    id: dealer.id,
    dealerId: dealer.id,
    name: dealer.name,
    slug: dealer.slug,
    description: dealer.description || "",
    phone: dealer.phone,
    address: dealer.address || "",
    cuisineType: dealer.cuisineType,
    logoUrl: dealer.logoUrl,
    coverUrl: dealer.coverUrl,
    rating: dealer.rating ?? 0,
    itemCount,
    priceRange: "$$",
    isOpen: true,
    isVerified: dealer.isVerified,
    ownerUserId: dealer.account.userId,
  };
}
