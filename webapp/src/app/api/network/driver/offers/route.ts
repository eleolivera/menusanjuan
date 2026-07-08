// GET /api/network/driver/offers
//
// Returns the current driver's PENDING, non-expired offers with enough context
// for the offers list UI: restaurant name+address (from the Dealer resolved via
// order.restauranteSlug), customer name/address, money, item count. Order is
// most-recently-offered first (matches offer-card visual stack).
//
// Contract per Phase-2 driver PWA plan (Task C).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function GET() {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const now = new Date();

  // Pull the offers + the Order fields we surface. Dealer name/address is
  // resolved in a second, batched query by slug so we don't need a compound
  // relation include (Order → Dealer is optional via dealerId; slug is the
  // stable public key we key everything off).
  const offers = await prisma.deliveryOffer.findMany({
    where: {
      driverId: session.driverId,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { offeredAt: "desc" },
    select: {
      id: true,
      orderId: true,
      offeredAt: true,
      expiresAt: true,
      distanceKm: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          restauranteSlug: true,
          customerName: true,
          customerAddress: true,
          total: true,
          deliveryFee: true,
          items: true,
        },
      },
    },
  });

  // Batch-fetch dealers for every distinct restauranteSlug in one round-trip.
  const slugs = Array.from(new Set(offers.map((o) => o.order.restauranteSlug)));
  const dealers = slugs.length
    ? await prisma.dealer.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, name: true, address: true },
      })
    : [];
  const dealerBySlug = new Map(dealers.map((d) => [d.slug, d]));

  const payload = offers.map((o) => {
    const dealer = dealerBySlug.get(o.order.restauranteSlug);
    // items is Json (OrderItem[]). Fall back to 0 for any malformed row rather
    // than 500 the whole list.
    const itemCount = Array.isArray(o.order.items) ? o.order.items.length : 0;
    return {
      id: o.id,
      orderId: o.orderId,
      offeredAt: o.offeredAt.toISOString(),
      expiresAt: o.expiresAt.toISOString(),
      distanceKm: o.distanceKm,
      order: {
        restauranteName: dealer?.name ?? o.order.restauranteSlug,
        restauranteAddress: dealer?.address ?? null,
        customerName: o.order.customerName,
        customerAddress: o.order.customerAddress,
        totalPrice: o.order.total,
        deliveryFee: o.order.deliveryFee,
        itemCount,
      },
    };
  });

  return NextResponse.json({ offers: payload });
}
