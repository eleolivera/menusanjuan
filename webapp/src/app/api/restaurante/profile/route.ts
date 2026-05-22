import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

/**
 * Accepts either a JSON string or an array. Validates max 5 zones, strict-asc radius (+1km).
 * Returns the JSON string to store, or null if input was null/empty.
 * Throws on invalid shape (caught by route caller).
 */
function validateAndStringifyZones(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null;
  let arr: unknown;
  if (typeof input === "string") {
    try { arr = JSON.parse(input); } catch { throw new Error("deliveryZones: JSON inválido"); }
  } else {
    arr = input;
  }
  if (!Array.isArray(arr)) throw new Error("deliveryZones: debe ser un array");
  if (arr.length === 0) return null;
  if (arr.length > 5) throw new Error("deliveryZones: máximo 5 zonas");
  const cleaned: { radius: number; price: number }[] = [];
  for (const z of arr) {
    if (!z || typeof z !== "object") throw new Error("deliveryZones: zona inválida");
    const r = Number((z as any).radius);
    const p = Number((z as any).price);
    if (!Number.isFinite(r) || r <= 0) throw new Error("deliveryZones: radio inválido");
    if (!Number.isFinite(p) || p < 0) throw new Error("deliveryZones: precio inválido");
    cleaned.push({ radius: r, price: p });
  }
  cleaned.sort((a, b) => a.radius - b.radius);
  for (let i = 1; i < cleaned.length; i++) {
    if (cleaned[i].radius - cleaned[i - 1].radius < 1) {
      throw new Error(`deliveryZones: cada zona debe tener radio al menos 1 km mayor que la anterior (zona ${i + 1})`);
    }
  }
  return JSON.stringify(cleaned);
}

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
    pickupEnabled: dealer.pickupEnabled,
    pickupHours: dealer.pickupHours,
    deliveryHours: dealer.deliveryHours,
    deliveryZones: dealer.deliveryZones,
    deliveryCloseRadius: dealer.deliveryCloseRadius,
    deliveryClosePrice: dealer.deliveryClosePrice,
    deliveryFarRadius: dealer.deliveryFarRadius,
    deliveryFarPrice: dealer.deliveryFarPrice,
    deliveryFee: dealer.deliveryFee,
    deliveryTimeMin: dealer.deliveryTimeMin,
    closedUntil: dealer.closedUntil ? dealer.closedUntil.toISOString() : null,
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
    isActive, deliveryEnabled, pickupEnabled, pickupHours, deliveryHours, deliveryZones, deliveryCloseRadius, deliveryClosePrice,
    deliveryFarRadius, deliveryFarPrice, deliveryFee, deliveryTimeMin,
  } = body;

  // Validate deliveryZones up-front so we can return 400 with a friendly message
  let zonesJson: string | null | undefined = undefined;
  if (deliveryZones !== undefined) {
    try {
      zonesJson = validateAndStringifyZones(deliveryZones);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

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
      ...(pickupEnabled !== undefined && { pickupEnabled }),
      ...(pickupHours !== undefined && { pickupHours }),
      ...(deliveryHours !== undefined && { deliveryHours }),
      ...(zonesJson !== undefined && { deliveryZones: zonesJson }),
      ...(deliveryCloseRadius !== undefined && { deliveryCloseRadius: deliveryCloseRadius !== null ? Number(deliveryCloseRadius) : null }),
      ...(deliveryClosePrice !== undefined && { deliveryClosePrice: deliveryClosePrice !== null ? Number(deliveryClosePrice) : null }),
      ...(deliveryFarRadius !== undefined && { deliveryFarRadius: deliveryFarRadius !== null ? Number(deliveryFarRadius) : null }),
      ...(deliveryFarPrice !== undefined && { deliveryFarPrice: deliveryFarPrice !== null ? Number(deliveryFarPrice) : null }),
      ...(deliveryFee !== undefined && { deliveryFee: deliveryFee !== null ? Number(deliveryFee) : null }),
      ...(deliveryTimeMin !== undefined && { deliveryTimeMin: deliveryTimeMin !== null ? Number(deliveryTimeMin) : null }),
    },
  });

  return NextResponse.json({ success: true, slug: updated.slug });
}
