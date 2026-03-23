import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — list unclaimed restaurants (placeholder @menusanjuan.com accounts)
export async function GET() {
  const dealers = await prisma.dealer.findMany({
    where: { isActive: true },
    include: {
      account: {
        include: { user: true },
      },
      categories: {
        include: { items: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const unclaimed = dealers
    .filter((d) => d.account.user.email.endsWith("@menusanjuan.com"))
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      cuisineType: d.cuisineType,
      address: d.address,
      coverUrl: d.coverUrl,
      description: d.description,
      itemCount: d.categories.reduce((s, c) => s + c.items.length, 0),
      categoryCount: d.categories.length,
    }));

  return NextResponse.json(unclaimed);
}
