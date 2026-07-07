// Resta-owned driver CRUD. Auth: owner session (getRestauranteFromSession).
// All returned/created drivers are scoped to Driver.ownerDealerId === dealer.id.
// Network drivers (ownerDealerId=null) are invisible from here — Elio manages
// those under /api/admin/network/drivers.
//
// Endpoints:
//   GET  /api/restaurante/drivers      → list this resta's drivers
//   POST /api/restaurante/drivers      → create a new driver, returns login code

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { generateDriverLoginCode, driverCodeExpiry } from "@/lib/driver-codes";
import { normalizePhoneE164 } from "@/lib/rewards";

export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const drivers = await prisma.driver.findMany({
    where: { ownerDealerId: dealer.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
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

  return NextResponse.json({ drivers });
}

export async function POST(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: string; displayName?: string; vehicleType?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const phoneCanonical = normalizePhoneE164(body.phone || "");
  if (!phoneCanonical) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  const displayName = (body.displayName || "").trim().slice(0, 60);
  if (!displayName) return NextResponse.json({ error: "missing_name" }, { status: 400 });
  const vehicleType = body.vehicleType ? String(body.vehicleType).slice(0, 20) : null;

  // Phone must be globally unique across drivers (one identity per person).
  const existing = await prisma.driver.findUnique({ where: { phone: phoneCanonical } });
  if (existing) {
    return NextResponse.json({ error: "phone_in_use", existingOwnedByYou: existing.ownerDealerId === dealer.id }, { status: 409 });
  }

  const loginCode = generateDriverLoginCode();
  const driver = await prisma.driver.create({
    data: {
      phone: phoneCanonical,
      displayName,
      vehicleType,
      loginCode,
      loginCodeExpiresAt: driverCodeExpiry(),
      ownerDealerId: dealer.id,
    },
    select: { id: true, phone: true, displayName: true, vehicleType: true, loginCode: true, loginCodeExpiresAt: true },
  });

  return NextResponse.json({ driver }, { status: 201 });
}
