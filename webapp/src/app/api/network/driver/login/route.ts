// Driver PWA login: `{ phone, code }` → sets the msj_driver_session cookie.
//
// Login codes stay valid until loginCodeExpiresAt (~7 days by default). We do
// NOT clear the code on login — drivers routinely install the PWA on multiple
// devices (phone + tablet, or lose browser data and reinstall) and asking the
// resta owner to regenerate the code every time is friction. Session cookie
// is 30 days and is what carries the actual identity; the code is just the
// device-onboarding step.

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
