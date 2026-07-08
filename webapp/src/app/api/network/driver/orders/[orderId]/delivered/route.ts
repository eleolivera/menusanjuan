// POST /api/network/driver/orders/[orderId]/delivered
//
// The assigned driver marks the order as DELIVERED. Optionally records a
// cash collection event against the driver's currently open shift so the
// close-shift screen can reconcile expected vs entered cash.
//
// Body: { cashCollected?: number }  // whole ARS
//
// - 403 if the caller isn't the assigned driver.
// - 409 if the order is already DELIVERED (idempotent guard so a double-tap
//   from a shaky mobile connection doesn't double-write a cash event).
// - If cashCollected > 0 but the driver has no open shift, the delivery
//   still succeeds — we don't want a stale/closed-shift state to block the
//   customer's handoff — but we skip the cash event and surface
//   { cashSkipped: true } so the client can nudge the driver to reopen a
//   shift and reconcile manually.
//
// markedDeliveredBy = "driver-network" so the audit trail differentiates
// the network driver PWA from the legacy /d/[orderId] QR page (which stamps
// "driver") and from owner/kanban/pos surfaces.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let body: { cashCollected?: unknown } = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") body = raw as { cashCollected?: unknown };
  } catch {
    // Empty body is allowed — the delivered call carries no payload when
    // the order was already PAID upfront (transfer / MP / prepaid card).
  }

  let cashCollected = 0;
  if (body.cashCollected != null) {
    if (typeof body.cashCollected !== "number" || !Number.isFinite(body.cashCollected)) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    cashCollected = Math.floor(body.cashCollected);
    if (cashCollected < 0) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, assignedDriverId: true, status: true },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (order.assignedDriverId !== session.driverId) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }

  if (order.status === "DELIVERED") {
    return NextResponse.json({ error: "already_delivered" }, { status: 409 });
  }

  // Only look up the open shift if we might need it — most orders won't
  // require a cash event (prepaid / non-cash) and the extra roundtrip is
  // wasted work.
  let openShiftId: string | null = null;
  if (cashCollected > 0) {
    const shift = await prisma.driverShift.findFirst({
      where: { driverId: session.driverId, endedAt: null },
      select: { id: true },
    });
    openShiftId = shift?.id ?? null;
  }

  const deliveredAt = new Date();
  const willRecordCash = cashCollected > 0 && openShiftId != null;

  const { cashEventId } = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        deliveredAt,
        markedDeliveredBy: "driver-network",
      },
    });

    if (!willRecordCash) return { cashEventId: null as string | null };

    const cashEvent = await tx.driverCashEvent.create({
      data: {
        driverId: session.driverId,
        shiftId: openShiftId!,
        orderId,
        amount: cashCollected,
        kind: "collect",
      },
      select: { id: true },
    });
    return { cashEventId: cashEvent.id };
  });

  const cashSkipped = cashCollected > 0 && openShiftId == null;

  return NextResponse.json({
    ok: true,
    deliveredAt: deliveredAt.toISOString(),
    cashEventId,
    ...(cashSkipped ? { cashSkipped: true } : {}),
  });
}
