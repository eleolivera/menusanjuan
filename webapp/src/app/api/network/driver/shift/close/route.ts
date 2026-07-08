// POST /api/network/driver/shift/close
// Closes the driver's currently-open DriverShift. Guards:
//   - 409 no_active_shift when the driver has no open shift row.
//   - 409 order_in_flight when the driver still has any non-DELIVERED
//     assigned Order (they must finish/hand it off first — otherwise cash
//     collected after close would land in a closed shift).
// On success: expected = cashOnHandStart + Σ(DriverCashEvent.amount);
// discrepancy = cashOnHandEnd − expected. Driver.onShift flipped to false in
// the same transaction so the flag can't drift from DriverShift.endedAt.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function POST(req: Request) {
  const session = await getDriverSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const rawEnd =
    body && typeof body === "object" && "cashOnHandEnd" in body
      ? (body as { cashOnHandEnd?: unknown }).cashOnHandEnd
      : undefined;
  if (typeof rawEnd !== "number" || !Number.isFinite(rawEnd) || rawEnd < 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const cashOnHandEnd = Math.floor(rawEnd);

  const shift = await prisma.driverShift.findFirst({
    where: { driverId: session.driverId, endedAt: null },
    select: { id: true, cashOnHandStart: true },
  });
  if (!shift) return NextResponse.json({ error: "no_active_shift" }, { status: 409 });

  const inFlight = await prisma.order.findFirst({
    where: { assignedDriverId: session.driverId, status: { not: "DELIVERED" } },
    select: { id: true },
  });
  if (inFlight) {
    return NextResponse.json({ error: "order_in_flight", orderId: inFlight.id }, { status: 409 });
  }

  const cashAgg = await prisma.driverCashEvent.aggregate({
    where: { shiftId: shift.id },
    _sum: { amount: true },
  });
  const sumEvents = cashAgg._sum.amount ?? 0;
  const expected = shift.cashOnHandStart + sumEvents;
  const discrepancy = cashOnHandEnd - expected;

  const closed = await prisma.$transaction(async (tx) => {
    const updated = await tx.driverShift.update({
      where: { id: shift.id },
      data: { endedAt: new Date(), cashOnHandEnd, discrepancy },
      select: { id: true, startedAt: true, endedAt: true, cashOnHandStart: true, cashOnHandEnd: true },
    });
    await tx.driver.update({ where: { id: session.driverId }, data: { onShift: false } });
    return updated;
  });

  return NextResponse.json({
    ok: true,
    expected,
    discrepancy,
    cashOnHandEnd,
    shift: {
      id: closed.id,
      startedAt: closed.startedAt.toISOString(),
      endedAt: closed.endedAt!.toISOString(),
      cashOnHandStart: closed.cashOnHandStart,
      cashOnHandEnd: closed.cashOnHandEnd!,
      expectedCash: expected,
      discrepancy,
    },
  });
}
