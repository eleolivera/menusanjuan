// Regenerate a driver's one-shot login code. Prior code (if any) is
// invalidated. Used when the owner lost the code before handing it off, or
// when a driver's phone is stolen and they need to re-establish a session.

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
    select: { id: true },
  });
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const loginCode = generateDriverLoginCode();
  const driver = await prisma.driver.update({
    where: { id: driverId },
    data: { loginCode, loginCodeExpiresAt: driverCodeExpiry() },
    select: { id: true, phone: true, displayName: true, loginCode: true, loginCodeExpiresAt: true },
  });
  return NextResponse.json({ driver });
}
