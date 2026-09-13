// GET /api/restaurante/promocionar?items=id1,id2&dias=5&diario=2000
// Returns the IG caption + Ads Manager recipe for the owner's active resta,
// plus the URL of the rendered creative. Pure read; no side effects.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { buildCaption, buildReceta } from "@/lib/promo-recipe";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const ids = (sp.get("items") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (ids.length === 0) return NextResponse.json({ error: "Elegí al menos un item" }, { status: 400 });

  const dias = Math.min(30, Math.max(1, Number(sp.get("dias") || 5)));
  const diario = Math.max(0, Number(sp.get("diario") || 2000));

  const rows = await prisma.menuItem.findMany({
    where: { id: { in: ids }, category: { dealerId: dealer.id } },
    select: { id: true, name: true, price: true, imageUrl: true, badge: true, pricingMode: true, weightUnit: true },
  });
  const items = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  if (items.length === 0) return NextResponse.json({ error: "Items no encontrados" }, { status: 404 });

  const promoDealer = {
    slug: dealer.slug,
    name: dealer.name,
    city: dealer.city,
    latitude: dealer.latitude,
    longitude: dealer.longitude,
    pickupHours: dealer.pickupHours,
    deliveryHours: dealer.deliveryHours,
    openHours: dealer.openHours,
    deliveryEnabled: dealer.deliveryEnabled,
    pickupEnabled: dealer.pickupEnabled,
    deliveryZones: dealer.deliveryZones,
    cuisineType: dealer.cuisineType,
  };

  const campaign = `promo-${new Date().toISOString().slice(0, 10)}`;
  return NextResponse.json({
    items: items.map((i) => ({ id: i.id, name: i.name, price: i.price })),
    caption: buildCaption(promoDealer, items, { campaign }),
    receta: buildReceta(promoDealer, items, { campaign, dias, diarioArs: diario }),
    creativeUrl: `/api/restaurante/promocionar/creative?items=${encodeURIComponent(ids.join(","))}`,
  });
}
