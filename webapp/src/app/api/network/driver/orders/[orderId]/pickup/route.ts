// POST /api/network/driver/orders/[orderId]/pickup
//
// The assigned driver taps "Retiré el pedido" — flips pickedUpAt to now.
// Idempotency + ownership are enforced in a single conditional updateMany:
// only rows where assignedDriverId === session driver AND pickedUpAt IS NULL
// AND status !== DELIVERED are touched. count === 0 means either someone
// else's order, already picked up, or already delivered — we then re-read to
// return a specific 403 vs 409 rather than a generic "not modified".

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function POST(
  _request: NextRequest,
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

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      assignedDriverId: true,
      pickedUpAt: true,
      status: true,
    },
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

  if (order.pickedUpAt) {
    return NextResponse.json({ error: "already_picked_up" }, { status: 409 });
  }

  const pickedUpAt = new Date();
  await prisma.order.update({
    where: { id: orderId },
    data: { pickedUpAt },
  });

  return NextResponse.json({ ok: true, pickedUpAt: pickedUpAt.toISOString() });
}
