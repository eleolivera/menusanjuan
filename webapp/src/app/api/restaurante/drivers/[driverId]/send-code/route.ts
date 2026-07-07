// Send the driver their current login code via WhatsApp. Owner clicks the
// "Enviar por WhatsApp" button in the DriverAdmin UI → this fires the WABA
// API (via lib/whatsapp.ts) with a simple text payload.
//
// Requires the driver to have a live loginCode. If expired, respond with
// "code_expired" so the UI can prompt the owner to regenerate first.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const driver = await prisma.driver.findFirst({
    where: { id: driverId, ownerDealerId: dealer.id },
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
