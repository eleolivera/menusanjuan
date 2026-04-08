import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";

async function authedDealerId(request: NextRequest): Promise<string | null> {
  const dealer = await getRestauranteFromSession();
  if (dealer?.id) return dealer.id;
  const admin = await getAdminSession();
  if (!admin) return null;
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) return null;
  const d = await prisma.dealer.findUnique({ where: { slug }, select: { id: true } });
  return d?.id || null;
}

// GET — list all presets for the current dealer
export async function GET(request: NextRequest) {
  const dealerId = await authedDealerId(request);
  if (!dealerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const presets = await prisma.optionPreset.findMany({
    where: { dealerId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(presets);
}

// POST — create a new preset
export async function POST(request: NextRequest) {
  const dealerId = await authedDealerId(request);
  if (!dealerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.name?.trim()) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });

  const maxSort = await prisma.optionPreset.aggregate({
    where: { dealerId },
    _max: { sortOrder: true },
  });

  const preset = await prisma.optionPreset.create({
    data: {
      dealerId,
      name: body.name.trim(),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      options: {
        create: (body.options || []).map((o: { name: string; priceDelta?: number; available?: boolean }, i: number) => ({
          name: o.name,
          priceDelta: o.priceDelta ?? 0,
          available: o.available ?? true,
          sortOrder: i,
        })),
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(preset);
}

// PATCH — update preset name or replace options
export async function PATCH(request: NextRequest) {
  const dealerId = await authedDealerId(request);
  if (!dealerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Verify ownership
  const existing = await prisma.optionPreset.findFirst({ where: { id: body.id, dealerId } });
  if (!existing) return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });

  // Update name
  if (body.name !== undefined) {
    await prisma.optionPreset.update({
      where: { id: body.id },
      data: { name: body.name.trim() },
    });
  }

  // Replace options if provided
  if (body.options) {
    await prisma.optionPresetChoice.deleteMany({ where: { presetId: body.id } });
    await prisma.optionPresetChoice.createMany({
      data: body.options.map((o: { name: string; priceDelta?: number; available?: boolean }, i: number) => ({
        presetId: body.id,
        name: o.name,
        priceDelta: o.priceDelta ?? 0,
        available: o.available ?? true,
        sortOrder: i,
      })),
    });
  }

  const updated = await prisma.optionPreset.findUnique({
    where: { id: body.id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}

// DELETE — delete a preset (cascade sets presetId=null on existing groups)
export async function DELETE(request: NextRequest) {
  const dealerId = await authedDealerId(request);
  if (!dealerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Verify ownership
  const existing = await prisma.optionPreset.findFirst({ where: { id, dealerId } });
  if (!existing) return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });

  await prisma.optionPreset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
