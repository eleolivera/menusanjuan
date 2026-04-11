import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

// GET — current restaurant profile
export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = dealer.account.user;
  const hasPassword = !!user.password && user.password.includes(":");
  const googleLinked = await prisma.oAuthAccount.count({
    where: { userId: user.id, provider: "google" },
  });

  return NextResponse.json({
    id: dealer.id,
    name: dealer.name,
    slug: dealer.slug,
    phone: dealer.phone,
    address: dealer.address,
    city: dealer.city,
    latitude: dealer.latitude,
    longitude: dealer.longitude,
    cuisineType: dealer.cuisineType,
    description: dealer.description,
    logoUrl: dealer.logoUrl,
    coverUrl: dealer.coverUrl,
    openHours: dealer.openHours,
    mercadoPagoAlias: dealer.mercadoPagoAlias,
    mercadoPagoCvu: dealer.mercadoPagoCvu,
    bankInfo: dealer.bankInfo,
    isActive: dealer.isActive,
    posEnabled: dealer.posEnabled,
    deliveryEnabled: dealer.deliveryEnabled,
    deliveryCloseRadius: dealer.deliveryCloseRadius,
    deliveryClosePrice: dealer.deliveryClosePrice,
    deliveryFarRadius: dealer.deliveryFarRadius,
    deliveryFarPrice: dealer.deliveryFarPrice,
    deliveryTimeMin: dealer.deliveryTimeMin,
    email: user.email,
    hasPassword,
    hasGoogle: googleLinked > 0,
  });
}

// PATCH — update restaurant profile
export async function PATCH(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name, phone, address, latitude, longitude, cuisineType,
    description, logoUrl, coverUrl, openHours,
    mercadoPagoAlias, mercadoPagoCvu, bankInfo, posEnabled,
    isActive, deliveryEnabled, deliveryCloseRadius, deliveryClosePrice,
    deliveryFarRadius, deliveryFarPrice, deliveryTimeMin,
  } = body;

  const updated = await prisma.dealer.update({
    where: { id: dealer.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(cuisineType !== undefined && { cuisineType }),
      ...(description !== undefined && { description }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(openHours !== undefined && { openHours }),
      ...(mercadoPagoAlias !== undefined && { mercadoPagoAlias }),
      ...(mercadoPagoCvu !== undefined && { mercadoPagoCvu }),
      ...(bankInfo !== undefined && { bankInfo }),
      ...(posEnabled !== undefined && { posEnabled }),
      ...(isActive !== undefined && { isActive }),
      ...(deliveryEnabled !== undefined && { deliveryEnabled }),
      ...(deliveryCloseRadius !== undefined && { deliveryCloseRadius: deliveryCloseRadius !== null ? Number(deliveryCloseRadius) : null }),
      ...(deliveryClosePrice !== undefined && { deliveryClosePrice: deliveryClosePrice !== null ? Number(deliveryClosePrice) : null }),
      ...(deliveryFarRadius !== undefined && { deliveryFarRadius: deliveryFarRadius !== null ? Number(deliveryFarRadius) : null }),
      ...(deliveryFarPrice !== undefined && { deliveryFarPrice: deliveryFarPrice !== null ? Number(deliveryFarPrice) : null }),
      ...(deliveryTimeMin !== undefined && { deliveryTimeMin: deliveryTimeMin !== null ? Number(deliveryTimeMin) : null }),
    },
  });

  return NextResponse.json({ success: true, slug: updated.slug });
}
