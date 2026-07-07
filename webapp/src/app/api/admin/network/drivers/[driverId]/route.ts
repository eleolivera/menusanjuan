// Network-driver per-row ops. Same shape as resta-driver PATCH/DELETE but
// scoped to ownerDealerId=null and gated by admin auth.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

async function networkDriver(driverId: string) {
  return prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: null },
    select: { id: true },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { driverId } = await params;

  const found = await networkDriver(driverId);
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
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { driverId } = await params;

  const found = await networkDriver(driverId);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.driver.update({
    where: { id: driverId },
    data: { isActive: false, onShift: false },
  });
  return NextResponse.json({ ok: true });
}
