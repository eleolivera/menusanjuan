import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// GET — list all restaurants with ownership status
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dealers = await prisma.dealer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      account: { include: { user: { select: { email: true, name: true } } } },
      categories: { select: { id: true } },
      _count: { select: { orders: true, claimRequests: true } },
    },
  });

  const restaurants = dealers.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    cuisineType: d.cuisineType,
    phone: d.phone,
    address: d.address,
    isActive: d.isActive,
    isVerified: d.isVerified,
    claimedAt: d.claimedAt,
    sourceProfileId: d.sourceProfileId,
    sourceSite: d.sourceSite,
    ownerEmail: d.account.user.email,
    isPlaceholder: d.account.user.email.endsWith("@menusanjuan.com"),
    categoryCount: d.categories.length,
    orderCount: d._count.orders,
    claimRequestCount: d._count.claimRequests,
    createdAt: d.createdAt,
  }));

  return NextResponse.json(restaurants);
}
