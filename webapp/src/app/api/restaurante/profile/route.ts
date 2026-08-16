import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteContext } from "@/lib/restaurante-auth";
import { isServiceOpenNow } from "@/lib/hours";
import { assertProfilePatchAllowed, NotOwnerError } from "@/lib/ownership";

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
  if (arr.length > 7) throw new Error("deliveryZones: máximo 7 zonas");
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

// GET — current restaurant profile.
// Under multi-user: the acting-user identity fields (email / hasPassword /
// hasGoogle) reflect THE CALLER'S OWN User, not the Account owner.
// SecuritySection on /restaurante/profile uses these to know which
// credentials it is managing. A STAFF caller sees her own email + linkage.
export async function GET() {
  const ctx = await getRestauranteContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { dealer, sessionUserId } = ctx;

  const actingUser = await prisma.user.findUnique({ where: { id: sessionUserId } });
  const hasPassword = !!actingUser?.password && actingUser.password.includes(":");
  const googleLinked = actingUser
    ? await prisma.oAuthAccount.count({ where: { userId: sessionUserId, provider: "google" } })
    : 0;

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
    deliveryPricingEnabled: dealer.deliveryPricingEnabled,
    deliveryMode: dealer.deliveryMode,
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
    openUntil: dealer.openUntil ? dealer.openUntil.toISOString() : null,
    // True if the resta's regular schedule says open right now (ignoring both
    // overrides). The CloseShopButton uses this to pick which CTA to show.
    scheduledOpen:
      isServiceOpenNow(dealer.pickupHours || dealer.openHours) ||
      isServiceOpenNow(dealer.deliveryHours || dealer.openHours),
    email: actingUser?.email ?? null,
    hasPassword,
    hasGoogle: googleLinked > 0,
    // Expose the acting user's role on this dealer so the client can hide
    // owner-only sections (Equipo, financial fields) for STAFF.
    role: ctx.role,
  });
}

// PATCH — update restaurant profile.
// Staff members may only edit the ops subset (open/close overrides,
// enable/disable delivery/pickup, hours JSON, description, cover/logo,
// cuisineType). Financial (mercadopago/bank), routing (deliveryMode +
// pricing), rewards master toggle, POS toggle, and resta identity
// (name/slug/address/city/lat/lng/phone) require OWNER. Enforced by
// assertProfilePatchAllowed which throws NotOwnerError on the first
// forbidden key — caught below and turned into a 403.
export async function PATCH(request: NextRequest) {
  const ctx = await getRestauranteContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { dealer, role } = ctx;

  const body = await request.json();
  try {
    assertProfilePatchAllowed(body, role);
  } catch (err) {
    if (err instanceof NotOwnerError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
  const {
    name, phone, address, latitude, longitude, cuisineType,
    description, logoUrl, coverUrl, openHours,
    mercadoPagoAlias, mercadoPagoCvu, bankInfo, posEnabled,
    isActive, deliveryEnabled, deliveryPricingEnabled, deliveryMode, pickupEnabled, pickupHours, deliveryHours, deliveryZones, deliveryCloseRadius, deliveryClosePrice,
    deliveryFarRadius, deliveryFarPrice, deliveryFee, deliveryTimeMin,
  } = body;

  // Validate deliveryMode against the DeliveryMode enum. Anything else drops.
  const VALID_MODES = ["MANUAL", "OWN", "NETWORK", "HYBRID"] as const;
  const validatedMode = deliveryMode !== undefined && VALID_MODES.includes(deliveryMode as typeof VALID_MODES[number])
    ? (deliveryMode as typeof VALID_MODES[number])
    : undefined;

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
      ...(deliveryPricingEnabled !== undefined && { deliveryPricingEnabled }),
      ...(validatedMode !== undefined && { deliveryMode: validatedMode }),
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
