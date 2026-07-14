// Approve a self-registered network driver (admin-scoped).
//
// Same contract as the resta-owned approve route, but scoped to network
// drivers (ownerDealerId=null). Flips pendingApproval=false and mints a fresh
// one-shot login code so admin can hand it off via WhatsApp (CodeSheet →
// wa.me). The response shape matches the resta variant so DriverAdmin.tsx
// renders the code sheet identically regardless of scope.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { generateDriverLoginCode, driverCodeExpiry } from "@/lib/driver-codes";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { driverId } = await params;

  const found = await prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: null },
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
