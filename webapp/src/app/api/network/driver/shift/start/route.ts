// POST /api/network/driver/shift/start
// Opens a new DriverShift for the authenticated driver. Rejects if the driver
// already has an open shift (single-active-shift business rule enforced via
// Driver.onShift). Shift row + Driver.onShift flip live in one transaction so
// the flag can't drift from the DriverShift table on partial failures.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function POST(req: Request) {
  const session = await getDriverSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty/missing body is fine — cashOnHandStart defaults to 0.
    body = {};
  }
  const raw =
    body && typeof body === "object" && "cashOnHandStart" in body
      ? (body as { cashOnHandStart?: unknown }).cashOnHandStart
      : undefined;
  if (raw !== undefined && (typeof raw !== "number" || !Number.isFinite(raw))) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const cashOnHandStart = Math.max(0, Math.floor(typeof raw === "number" ? raw : 0));

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: { id: true, onShift: true },
  });
  if (!driver) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (driver.onShift) {
    return NextResponse.json({ error: "shift_already_active" }, { status: 409 });
  }

  const shift = await prisma.$transaction(async (tx) => {
    const created = await tx.driverShift.create({
      data: { driverId: driver.id, cashOnHandStart },
      select: { id: true, startedAt: true, cashOnHandStart: true },
    });
    await tx.driver.update({ where: { id: driver.id }, data: { onShift: true } });
    return created;
  });

  return NextResponse.json({
    ok: true,
    shiftId: shift.id,
    shift: {
      id: shift.id,
      startedAt: shift.startedAt.toISOString(),
      cashOnHandStart: shift.cashOnHandStart,
    },
  });
}
