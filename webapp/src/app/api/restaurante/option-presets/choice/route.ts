import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";

// PATCH — toggle availability of a single choice (quick "sin stock" action)
export async function PATCH(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  const adminSession = !dealer ? await getAdminSession() : null;
  if (!dealer && !adminSession) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Verify ownership via preset -> dealer
  const choice = await prisma.optionPresetChoice.findUnique({
    where: { id: body.id },
    include: { preset: { select: { dealerId: true } } },
  });
  if (!choice) return NextResponse.json({ error: "Opcion no encontrada" }, { status: 404 });

  // Owner session: must own the preset
  if (dealer && choice.preset.dealerId !== dealer.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // Admin session: require ?slug= and verify it matches the preset's dealer
  if (!dealer && adminSession) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "Falta slug" }, { status: 400 });
    const target = await prisma.dealer.findUnique({ where: { slug }, select: { id: true } });
    if (!target || target.id !== choice.preset.dealerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const updated = await prisma.optionPresetChoice.update({
    where: { id: body.id },
    data: {
      ...(body.available !== undefined && { available: body.available }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.priceDelta !== undefined && { priceDelta: body.priceDelta }),
    },
  });

  return NextResponse.json(updated);
}
