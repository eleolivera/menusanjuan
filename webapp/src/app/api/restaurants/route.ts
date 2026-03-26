import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Restaurant } from "@/data/restaurants";

export async function GET() {
  const dbDealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      categories: { select: { _count: { select: { items: true } } } },
    },
    orderBy: [{ rating: "desc" }, { name: "asc" }],
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
    coverUrl: d.coverUrl,
    rating: d.rating ?? 0,
    itemCount: d.categories.reduce((s, c) => s + c._count.items, 0),
    priceRange: "$$",
    isOpen: true,
  }));

  return NextResponse.json(restaurants);
}
