// Driver PWA login: `{ phone, code }` → sets the msj_driver_session cookie.
//
// Single-use login codes are minted elsewhere (admin/owner triggers a code
// send via WhatsApp). Here we normalize the incoming phone, atomically clear
// the code on success (so the same code can't be replayed), and stamp the
// session cookie. The code is uppercased before compare so drivers can type
// it lowercase without failing auth.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneE164 } from "@/lib/rewards";
import { setDriverSessionCookie } from "@/lib/driver-auth";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { phone, code } = body as { phone?: unknown; code?: unknown };
  if (typeof phone !== "string" || typeof code !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const normalized = normalizePhoneE164(phone);
  if (!normalized) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const upperCode = code.trim().toUpperCase();
  if (!upperCode) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const driver = await prisma.driver.findFirst({
    where: {
      phone: normalized,
      isActive: true,
      loginCode: upperCode,
      loginCodeExpiresAt: { gt: new Date() },
    },
  });
  if (!driver) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: { loginCode: null, loginCodeExpiresAt: null },
  });
  await setDriverSessionCookie(driver.id);

  return NextResponse.json({
    ok: true,
    driver: {
      id: driver.id,
      displayName: driver.displayName,
      ownerDealerId: driver.ownerDealerId,
      vehicleType: driver.vehicleType,
    },
  });
}
