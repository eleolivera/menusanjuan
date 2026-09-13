// GET /api/restaurante/promocionar/creative?items=id1,id2,id3
// Renders the 1080×1080 Instagram promo card as PNG for the owner's active
// resta. Owner-auth'd; items are tenant-scoped (must belong to the dealer).

import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { PromoCard, PROMO_SIZE, loadPromoFonts } from "@/lib/promo-creative";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const ids = (request.nextUrl.searchParams.get("items") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (ids.length === 0) return NextResponse.json({ error: "Elegí al menos un item" }, { status: 400 });

  const rows = await prisma.menuItem.findMany({
    where: { id: { in: ids }, category: { dealerId: dealer.id } },
    select: { id: true, name: true, price: true, imageUrl: true, badge: true, pricingMode: true, weightUnit: true },
  });
  // Preserve the order the owner picked.
  const items = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  if (items.length === 0) return NextResponse.json({ error: "Items no encontrados" }, { status: 404 });

  return new ImageResponse(
    <PromoCard
      dealer={{
        slug: dealer.slug,
        name: dealer.name,
        logoUrl: dealer.logoUrl,
        latitude: dealer.latitude,
        longitude: dealer.longitude,
        deliveryEnabled: dealer.deliveryEnabled,
        pickupEnabled: dealer.pickupEnabled,
      }}
      items={items}
    />,
    {
      ...PROMO_SIZE,
      fonts: loadPromoFonts(),
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${dealer.slug}-promo.png"`,
      },
    },
  );
}
