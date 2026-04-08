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

  if (dealer && choice.preset.dealerId !== dealer.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
