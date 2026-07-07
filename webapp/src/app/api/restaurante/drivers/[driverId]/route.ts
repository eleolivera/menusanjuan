// Per-driver operations for resta-owned drivers.
//
//   PATCH  /api/restaurante/drivers/[driverId]  → update {isActive, displayName, vehicleType}
//   POST   /api/restaurante/drivers/[driverId]/regenerate-code  → new one-shot login code (kept separate route)
//   DELETE /api/restaurante/drivers/[driverId]  → soft-deactivate (we never hard-delete a Driver with orders)
//
// Every op verifies Driver.ownerDealerId === session dealer.id — a resta owner
// can NOT touch network drivers or another resta's drivers.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

async function ownedDriver(driverId: string, dealerId: string) {
  return prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: dealerId },
    select: { id: true, ownerDealerId: true },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const found = await ownedDriver(driverId, dealer.id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: { isActive?: boolean; displayName?: string; vehicleType?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.displayName === "string") {
    const dn = body.displayName.trim().slice(0, 60);
    if (dn) data.displayName = dn;
  }
  if (body.vehicleType === null) data.vehicleType = null;
  else if (typeof body.vehicleType === "string") data.vehicleType = body.vehicleType.slice(0, 20);

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const driver = await prisma.driver.update({
    where: { id: driverId },
    data,
    select: { id: true, phone: true, displayName: true, vehicleType: true, isActive: true },
  });
  return NextResponse.json({ driver });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const found = await ownedDriver(driverId, dealer.id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Soft-deactivate. Preserves cash history, past shifts, past offers.
  await prisma.driver.update({
    where: { id: driverId },
    data: { isActive: false, onShift: false },
  });
  return NextResponse.json({ ok: true });
}
