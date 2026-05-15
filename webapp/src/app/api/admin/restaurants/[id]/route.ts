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
      categories: { include: { items: { orderBy: { sortOrder: "asc" }, include: { optionGroups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } }, preset: { include: { options: { orderBy: { sortOrder: "asc" } } } } } } } } }, orderBy: { sortOrder: "asc" } },
      claimRequests: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { requestedAt: "desc" },
      },
      _count: { select: { orders: true } },
      onboardingCard: { select: { lastPassword: true } },
    },
  });

  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Resolve preset options into each group's options array
  const normalizedCategories = dealer.categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      optionGroups: item.optionGroups.map((g: any) => ({
        ...g,
        options: g.preset
          ? g.preset.options.map((o: any) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available }))
          : g.options,
      })),
    })),
  }));

  return NextResponse.json({
    ...dealer,
    categories: normalizedCategories,
    ownerEmail: dealer.account.user.email,
    ownerName: dealer.account.user.name,
    ownerId: dealer.account.user.id,
    isPlaceholder: dealer.account.user.email.endsWith("@menusanjuan.com"),
    orderCount: dealer._count.orders,
    lastPassword: dealer.onboardingCard?.lastPassword || null,
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
    isActive, posEnabled, openHours, mercadoPagoAlias, mercadoPagoCvu, bankInfo,
    sourceProfileId, sourceSite, rating, deliveryFee, deliveryTimeMin,
    deliveryEnabled, pickupEnabled, pickupHours, deliveryHours, deliveryZones,
    deliveryCloseRadius, deliveryClosePrice, deliveryFarRadius, deliveryFarPrice,
  } = body;

  // Validate deliveryZones — inline since this route doesn't share imports with profile
  let zonesJson: string | null | undefined = undefined;
  if (deliveryZones !== undefined) {
    if (deliveryZones === null || deliveryZones === "") {
      zonesJson = null;
    } else {
      try {
        const arr = typeof deliveryZones === "string" ? JSON.parse(deliveryZones) : deliveryZones;
        if (!Array.isArray(arr)) throw new Error("deliveryZones debe ser array");
        if (arr.length > 5) throw new Error("Máximo 5 zonas");
        const cleaned = arr.map((z: any) => {
          const r = Number(z?.radius), p = Number(z?.price);
          if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(p) || p < 0) throw new Error("Zona inválida");
          return { radius: r, price: p };
        }).sort((a, b) => a.radius - b.radius);
        for (let i = 1; i < cleaned.length; i++) {
          if (cleaned[i].radius - cleaned[i - 1].radius < 1) throw new Error(`Zona ${i + 1} debe ser al menos 1km mayor que la anterior`);
        }
        zonesJson = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }
  }

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
      ...(posEnabled !== undefined && { posEnabled }),
      ...(openHours !== undefined && { openHours }),
      ...(mercadoPagoAlias !== undefined && { mercadoPagoAlias }),
      ...(mercadoPagoCvu !== undefined && { mercadoPagoCvu }),
      ...(bankInfo !== undefined && { bankInfo }),
      ...(sourceProfileId !== undefined && { sourceProfileId }),
      ...(sourceSite !== undefined && { sourceSite }),
      ...(rating !== undefined && { rating: rating === null ? null : Number(rating) }),
      ...(deliveryFee !== undefined && { deliveryFee: deliveryFee === null ? null : Number(deliveryFee) }),
      ...(deliveryTimeMin !== undefined && { deliveryTimeMin: deliveryTimeMin === null ? null : Number(deliveryTimeMin) }),
      ...(deliveryEnabled !== undefined && { deliveryEnabled }),
      ...(pickupEnabled !== undefined && { pickupEnabled }),
      ...(pickupHours !== undefined && { pickupHours }),
      ...(deliveryHours !== undefined && { deliveryHours }),
      ...(zonesJson !== undefined && { deliveryZones: zonesJson }),
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
