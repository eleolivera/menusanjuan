// POST /api/restaurante/orders/[orderId]/assign
//
// Resta owner manual driver override. Bypasses the P3 dispatch pipeline —
// no DeliveryOffer is created, the owner is stamping a driver directly.
//
// Scope: owner can ONLY force-assign their OWN drivers (Driver.ownerDealerId
// === dealer.id). Network drivers (ownerDealerId === null) or another resta's
// drivers are refused with 403 not_your_driver.
//
// Semantics:
//   - Verify order exists AND order.restauranteSlug === session dealer.slug
//     → else 403 not_your_order (avoid leaking existence to a wrong owner).
//   - Verify driver exists AND driver.ownerDealerId === dealer.id
//     → else 403 not_your_driver.
//   - Driver must be isActive && onShift → else 409 driver_not_available.
//   - Driver must have no in-flight assignment (any Order with status !=
//     DELIVERED already assigned to them) → else 409 driver_busy.
//   - $transaction: cancel any PENDING DeliveryOffer for the order, then
//     stamp Order.assignedDriverId. No new offer row created — this is direct
//     forced assignment; we skip the acceptance cycle entirely.
//
// Returns { ok: true, orderId, driverId } on success.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;

  let body: { driverId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const driverId = typeof body?.driverId === "string" ? body.driverId : "";
  if (!driverId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, restauranteSlug: true },
  });
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.restauranteSlug !== dealer.slug) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      ownerDealerId: true,
      isActive: true,
      onShift: true,
    },
  });
  if (!driver) {
    return NextResponse.json({ error: "driver_not_found" }, { status: 404 });
  }
  if (driver.ownerDealerId !== dealer.id) {
    // Covers both network drivers (ownerDealerId === null) and other restas'
    // drivers. Owners can only force-assign their own fleet.
    return NextResponse.json({ error: "not_your_driver" }, { status: 403 });
  }
  if (!driver.isActive || !driver.onShift) {
    return NextResponse.json({ error: "driver_not_available" }, { status: 409 });
  }

  // In-flight guard: any Order with status != DELIVERED already stamped to
  // this driver means they're mid-run. Prevents double-booking.
  const inFlight = await prisma.order.findFirst({
    where: {
      assignedDriverId: driver.id,
      status: { not: "DELIVERED" },
      id: { not: orderId },
    },
    select: { id: true },
  });
  if (inFlight) {
    return NextResponse.json({ error: "driver_busy" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    // Cancel any live PENDING offer for this order — the owner is overriding
    // dispatch; whatever driver was being offered should stop seeing it.
    await tx.deliveryOffer.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { assignedDriverId: driver.id },
    });
  });

  return NextResponse.json({ ok: true, orderId, driverId: driver.id });
}
