import { prisma } from "./prisma";
import { DEMO_RESTAURANTS } from "@/data/restaurants";
import type { Restaurant } from "@/data/restaurants";

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  // Check demo data first
  const demo = DEMO_RESTAURANTS.find((r) => r.slug === slug);
  if (demo) return demo;

  // Check DB
  const dealer = await prisma.dealer.findUnique({
    where: { slug },
  });

  if (!dealer || !dealer.isActive) return null;

  return {
    id: dealer.id,
    name: dealer.name,
    slug: dealer.slug,
    description: dealer.description || "",
    phone: dealer.phone,
    address: dealer.address || "",
    cuisineType: dealer.cuisineType,
    logoUrl: dealer.logoUrl,
    coverUrl: dealer.coverUrl || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop",
    rating: 0,
    itemCount: 0,
    priceRange: "$$",
    isOpen: true,
  };
}
