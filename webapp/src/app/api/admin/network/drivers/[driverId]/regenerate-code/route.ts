import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { generateDriverLoginCode, driverCodeExpiry } from "@/lib/driver-codes";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { driverId } = await params;

  const found = await prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: null },
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
