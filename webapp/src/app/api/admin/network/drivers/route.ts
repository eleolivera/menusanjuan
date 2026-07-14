// Network driver CRUD (MenuSanJuan's own drivers). Admin auth via
// getAdminSession. All drivers created here have ownerDealerId = null so
// they show up in the network pool for ANY resta whose deliveryMode is
// NETWORK or HYBRID.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { generateDriverLoginCode, driverCodeExpiry } from "@/lib/driver-codes";
import { normalizePhoneE164 } from "@/lib/rewards";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const drivers = await prisma.driver.findMany({
    where: { ownerDealerId: null },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      phone: true,
      displayName: true,
      vehicleType: true,
      isActive: true,
      pendingApproval: true,
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
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: string; displayName?: string; vehicleType?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const phoneCanonical = normalizePhoneE164(body.phone || "");
  if (!phoneCanonical) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  const displayName = (body.displayName || "").trim().slice(0, 60);
  if (!displayName) return NextResponse.json({ error: "missing_name" }, { status: 400 });
  const vehicleType = body.vehicleType ? String(body.vehicleType).slice(0, 20) : null;

  // Resurrect if this phone belongs to a soft-deleted network driver. A phone
  // owned by any resta, or active anywhere, still 409s.
  const existing = await prisma.driver.findUnique({ where: { phone: phoneCanonical } });
  if (existing && (existing.ownerDealerId !== null || existing.isActive)) {
    return NextResponse.json({ error: "phone_in_use", isNetwork: existing.ownerDealerId === null }, { status: 409 });
  }

  const loginCode = generateDriverLoginCode();
  const driver = existing
    ? await prisma.driver.update({
        where: { id: existing.id },
        data: {
          displayName,
          vehicleType,
          isActive: true,
          onShift: false,
          loginCode,
          loginCodeExpiresAt: driverCodeExpiry(),
        },
        select: { id: true, phone: true, displayName: true, vehicleType: true, loginCode: true, loginCodeExpiresAt: true },
      })
    : await prisma.driver.create({
        data: {
          phone: phoneCanonical,
          displayName,
          vehicleType,
          loginCode,
          loginCodeExpiresAt: driverCodeExpiry(),
          ownerDealerId: null,
        },
        select: { id: true, phone: true, displayName: true, vehicleType: true, loginCode: true, loginCodeExpiresAt: true },
      });

  return NextResponse.json({ driver }, { status: 201 });
}
