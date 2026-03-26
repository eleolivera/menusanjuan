import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Restaurant } from "@/data/restaurants";

export async function GET() {
  const dbDealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      categories: { select: { _count: { select: { items: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const restaurants: Restaurant[] = dbDealers.map((d) => ({
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
    itemCount: d.categories.reduce((s, c) => s + c._count.items, 0),
    priceRange: "$$",
    isOpen: true,
  }));

  return NextResponse.json(restaurants);
}
