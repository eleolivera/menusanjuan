import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_RESTAURANTS } from "@/data/restaurants";
import type { Restaurant } from "@/data/restaurants";

export async function GET() {
  // Get real restaurants from DB
  const dbDealers = await prisma.dealer.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const dbRestaurants: Restaurant[] = dbDealers.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description || "",
    phone: d.phone,
    address: d.address || "",
    cuisineType: d.cuisineType,
    logoUrl: d.logoUrl,
    coverUrl: d.coverUrl || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop",
    rating: 0,
    itemCount: 0,
    priceRange: "$$",
    isOpen: true,
  }));

  // Merge: DB restaurants first, then demo (filter out slugs that exist in DB)
  const dbSlugs = new Set(dbRestaurants.map((r) => r.slug));
  const demoOnly = DEMO_RESTAURANTS.filter((r) => !dbSlugs.has(r.slug));

  return NextResponse.json([...dbRestaurants, ...demoOnly]);
}
