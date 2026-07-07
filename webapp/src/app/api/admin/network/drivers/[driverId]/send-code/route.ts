import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { driverId } = await params;

  const driver = await prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: null },
    select: { id: true, phone: true, displayName: true, loginCode: true, loginCodeExpiresAt: true },
  });
  if (!driver) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!driver.loginCode) return NextResponse.json({ error: "no_code" }, { status: 400 });
  if (driver.loginCodeExpiresAt && driver.loginCodeExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }

  const firstName = driver.displayName.split(/\s+/)[0] || driver.displayName;
  const message =
    `Hola ${firstName}! Tu código para MenuSanJuan Repartidor: *${driver.loginCode}*\n\n` +
    `Instalá desde https://menusanjuan.com/repartidor y usá ese código junto a tu número.`;

  const result = await sendWhatsAppMessage(driver.phone, message);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ ok: true });
}
