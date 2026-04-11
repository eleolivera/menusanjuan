import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const dbDealers = await prisma.dealer.findMany({
      where: { isActive: true },
      include: {
        categories: { select: { _count: { select: { items: true } } } },
        dealerCuisines: { include: { cuisineType: { select: { label: true, emoji: true } } } },
      },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
    });

    const restaurants = dbDealers.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      description: d.description || "",
      phone: d.phone,
      address: d.address || "",
      cuisineType: d.cuisineType, // legacy — keep for backward compat
      cuisineTypes: d.dealerCuisines.map(dc => ({ label: dc.cuisineType.label, emoji: dc.cuisineType.emoji })),
      logoUrl: d.logoUrl,
      coverUrl: d.coverUrl,
      rating: d.rating ?? 0,
      itemCount: d.categories.reduce((s, c) => s + c._count.items, 0),
      priceRange: "$$",
      isOpen: true,
      deliveryTimeMin: d.deliveryTimeMin ?? null,
    }));

    return NextResponse.json(restaurants);
  } catch (err: any) {
    console.error("Restaurants API error:", err.message);
    return NextResponse.json([], { status: 200 });
  }
}
