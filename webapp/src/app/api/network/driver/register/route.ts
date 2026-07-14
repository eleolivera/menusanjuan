import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneE164 } from "@/lib/rewards";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

// Public driver self-registration.
// Creates a Driver row with pendingApproval=true and NO loginCode.
// Approval endpoints (owner + admin) flip pendingApproval=false and mint the loginCode.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = authLimiter(ip);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const displayName = (typeof body.displayName === "string" ? body.displayName : "").trim().slice(0, 60);
  const phoneCanonical = normalizePhoneE164(typeof body.phone === "string" ? body.phone : "");
  const vehicleType = body.vehicleType;
  const restaSlug = typeof body.restaSlug === "string" ? body.restaSlug.trim() : "";

  if (!displayName) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }
  if (!phoneCanonical) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  if (typeof vehicleType !== "string" || !["moto", "auto", "bike"].includes(vehicleType)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let ownerDealerId: string | null = null;
  if (restaSlug) {
    const dealer = await prisma.dealer.findUnique({
      where: { slug: restaSlug },
      select: { id: true },
    });
    if (!dealer) {
      return NextResponse.json({ error: "invalid_resta" }, { status: 400 });
    }
    ownerDealerId = dealer.id;
  }

  const existing = await prisma.driver.findUnique({
    where: { phone: phoneCanonical },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: { id: true, ownerDealerId: true, pendingApproval: true } as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  if (existing) {
    if (existing.pendingApproval === true && existing.ownerDealerId === ownerDealerId) {
      return NextResponse.json({ ok: true, alreadyPending: true, driverId: existing.id });
    }
    return NextResponse.json({ error: "phone_in_use" }, { status: 409 });
  }

  const driver = await prisma.driver.create({
    // Cast to any because the schema regen for `pendingApproval` may still be
    // running in parallel with this task; the field exists in the DB by the
    // time this route is deployed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      phone: phoneCanonical,
      displayName,
      vehicleType,
      isActive: true,
      pendingApproval: true,
      onShift: false,
      ownerDealerId,
    } as any,
    select: { id: true },
  });

  return NextResponse.json({ ok: true, driverId: driver.id, pending: true }, { status: 201 });
}
