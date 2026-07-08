// Admin manual override: force-assign an order to a specific driver, bypassing
// the offer/acceptance cycle. Cancels any in-flight PENDING offer for the same
// order, then writes Order.assignedDriverId directly. Admin can target any
// driver (network or resta-owned) — no ownerDealerId scope check.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;

  let body: { driverId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const driverId = typeof body.driverId === "string" ? body.driverId.trim() : "";
  if (!driverId) {
    return NextResponse.json({ error: "missing_driver_id" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true, isActive: true, onShift: true },
  });
  if (!driver) {
    return NextResponse.json({ error: "driver_not_found" }, { status: 404 });
  }
  if (!driver.isActive || !driver.onShift) {
    return NextResponse.json({ error: "driver_unavailable" }, { status: 409 });
  }

  // Driver double-booking guard: any non-DELIVERED order already pointing at
  // this driver blocks the assignment.
  const busy = await prisma.order.findFirst({
    where: {
      assignedDriverId: driver.id,
      status: { not: "DELIVERED" },
    },
    select: { id: true },
  });
  if (busy) {
    return NextResponse.json({ error: "driver_busy" }, { status: 409 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryOffer.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: now },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { assignedDriverId: driver.id },
    }),
  ]);

  return NextResponse.json({ ok: true, orderId, driverId: driver.id });
}
