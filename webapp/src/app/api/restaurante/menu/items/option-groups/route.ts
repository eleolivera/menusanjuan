import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

// POST — create option group with options
export async function POST(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { menuItemId, title, minSelections, maxSelections, options, presetId } = await request.json();
  if (!menuItemId || !title) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  // Verify item belongs to this dealer
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, category: { dealerId: dealer.id } },
  });
  if (!item) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });

  // Verify preset belongs to this dealer if provided
  if (presetId) {
    const preset = await prisma.optionPreset.findFirst({
      where: { id: presetId, dealerId: dealer.id },
    });
    if (!preset) return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });
  }

  const maxSort = await prisma.optionGroup.aggregate({
    where: { menuItemId },
    _max: { sortOrder: true },
  });

  const group = await prisma.optionGroup.create({
    data: {
      menuItemId,
      title,
      minSelections: minSelections ?? 0,
      maxSelections: maxSelections ?? 1,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      presetId: presetId || null,
      // Only create inline options if no preset is linked
      options: presetId ? undefined : {
        create: (options || []).map((o: { name: string; priceDelta?: number; available?: boolean }, i: number) => ({
          name: o.name,
          priceDelta: o.priceDelta ?? 0,
          available: o.available ?? true,
          sortOrder: i,
        })),
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(group);
}

// PATCH — update option group (title, rules, replace options)
export async function PATCH(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, title, minSelections, maxSelections, options, presetId } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Verify ownership
  const group = await prisma.optionGroup.findFirst({
    where: { id, menuItem: { category: { dealerId: dealer.id } } },
  });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  // Verify preset belongs to this dealer if provided
  if (presetId) {
    const preset = await prisma.optionPreset.findFirst({
      where: { id: presetId, dealerId: dealer.id },
    });
    if (!preset) return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });
  }

  // Update group fields
  await prisma.optionGroup.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(minSelections !== undefined && { minSelections }),
      ...(maxSelections !== undefined && { maxSelections }),
      ...(presetId !== undefined && { presetId: presetId || null }),
    },
  });

  // Replace options if provided AND no preset is linked
  if (options && !presetId) {
    await prisma.optionChoice.deleteMany({ where: { optionGroupId: id } });
    await prisma.optionChoice.createMany({
      data: options.map((o: { name: string; priceDelta?: number; available?: boolean }, i: number) => ({
        optionGroupId: id,
        name: o.name,
        priceDelta: o.priceDelta ?? 0,
        available: o.available ?? true,
        sortOrder: i,
      })),
    });
  }

  // If switching TO a preset, clear inline options
  if (presetId) {
    await prisma.optionChoice.deleteMany({ where: { optionGroupId: id } });
  }

  const result = await prisma.optionGroup.findUnique({
    where: { id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(result);
}

// DELETE — delete option group and its options
export async function DELETE(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const group = await prisma.optionGroup.findFirst({
    where: { id, menuItem: { category: { dealerId: dealer.id } } },
  });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  await prisma.optionGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
