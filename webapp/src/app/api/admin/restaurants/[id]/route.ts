import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// GET — single restaurant with full details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: {
      account: { include: { user: { select: { id: true, email: true, name: true, phone: true } } } },
      categories: { include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      claimRequests: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { requestedAt: "desc" },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({
    ...dealer,
    ownerEmail: dealer.account.user.email,
    ownerName: dealer.account.user.name,
    ownerId: dealer.account.user.id,
    isPlaceholder: dealer.account.user.email.endsWith("@menusanjuan.com"),
    orderCount: dealer._count.orders,
  });
}

// PATCH — update restaurant fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const {
    name, slug, phone, address, city, latitude, longitude,
    cuisineType, description, logoUrl, coverUrl,
    isActive, openHours, mercadoPagoAlias, mercadoPagoCvu, bankInfo,
    sourceProfileId, sourceSite, rating, deliveryFee,
    deliveryEnabled, deliveryCloseRadius, deliveryClosePrice, deliveryFarRadius, deliveryFarPrice,
  } = body;

  const updated = await prisma.dealer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(cuisineType !== undefined && { cuisineType }),
      ...(description !== undefined && { description }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(isActive !== undefined && { isActive }),
      ...(openHours !== undefined && { openHours }),
      ...(mercadoPagoAlias !== undefined && { mercadoPagoAlias }),
      ...(mercadoPagoCvu !== undefined && { mercadoPagoCvu }),
      ...(bankInfo !== undefined && { bankInfo }),
      ...(sourceProfileId !== undefined && { sourceProfileId }),
      ...(sourceSite !== undefined && { sourceSite }),
      ...(rating !== undefined && { rating: rating === null ? null : Number(rating) }),
      ...(deliveryFee !== undefined && { deliveryFee: deliveryFee === null ? null : Number(deliveryFee) }),
      ...(deliveryEnabled !== undefined && { deliveryEnabled }),
      ...(deliveryCloseRadius !== undefined && { deliveryCloseRadius: deliveryCloseRadius === null ? null : Number(deliveryCloseRadius) }),
      ...(deliveryClosePrice !== undefined && { deliveryClosePrice: deliveryClosePrice === null ? null : Number(deliveryClosePrice) }),
      ...(deliveryFarRadius !== undefined && { deliveryFarRadius: deliveryFarRadius === null ? null : Number(deliveryFarRadius) }),
      ...(deliveryFarPrice !== undefined && { deliveryFarPrice: deliveryFarPrice === null ? null : Number(deliveryFarPrice) }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE — delete restaurant + clean up orphaned placeholder user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: { account: { include: { user: true } } },
  });
  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const ownerUserId = dealer.account.userId;
  const isPlaceholder = dealer.account.user.email.endsWith("@menusanjuan.com");

  // Delete the dealer (cascades to menu, claims, orders)
  await prisma.dealer.delete({ where: { id } });

  // Delete the account
  await prisma.account.delete({ where: { id: dealer.account.id } });

  // If the owner was a placeholder with no other accounts, delete them too
  if (isPlaceholder) {
    const otherAccounts = await prisma.account.count({ where: { userId: ownerUserId } });
    if (otherAccounts === 0) {
      await prisma.user.delete({ where: { id: ownerUserId } });
    }
  }

  return NextResponse.json({ success: true });
}
