import { prisma } from "./prisma";
import type { Restaurant } from "@/data/restaurants";

export type RestaurantWithDealerId = Restaurant & { dealerId: string | null };

export async function getRestaurantBySlug(slug: string): Promise<RestaurantWithDealerId | null> {
  const dealer = await prisma.dealer.findUnique({
    where: { slug },
  });

  if (!dealer) return null;

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
    itemCount: 0,
    priceRange: "$$",
    isOpen: true,
  };
}
