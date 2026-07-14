// Approve a self-registered driver (resta-scoped).
//
// A driver row created via POST /api/network/driver/register lives with
// pendingApproval=true and loginCode=null until the resta owner approves it
// here. Approval flips the flag and mints a fresh one-shot login code the
// owner then hands off via WhatsApp (CodeSheet → wa.me).
//
// Ownership check mirrors the sibling routes: Driver.ownerDealerId must equal
// the session dealer.id, so a resta owner can NOT approve a network driver
// (ownerDealerId=null) or another resta's pending row.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { generateDriverLoginCode, driverCodeExpiry } from "@/lib/driver-codes";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const found = await prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: dealer.id },
    select: { id: true, pendingApproval: true },
  });
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!found.pendingApproval) return NextResponse.json({ error: "not_pending" }, { status: 409 });

  const loginCode = generateDriverLoginCode();
  const driver = await prisma.driver.update({
    where: { id: driverId },
    data: { pendingApproval: false, loginCode, loginCodeExpiresAt: driverCodeExpiry() },
    select: {
      id: true,
      phone: true,
      displayName: true,
      vehicleType: true,
      isActive: true,
      loginCode: true,
      loginCodeExpiresAt: true,
      onShift: true,
      lastPingAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ ok: true, driver });
}
