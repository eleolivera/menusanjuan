import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// POST — add category or menu item (admin)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: dealerId } = await params;
  const body = await request.json();

  if (body.type === "category") {
    const maxSort = await prisma.menuCategory.aggregate({
      where: { dealerId },
      _max: { sortOrder: true },
    });
    const category = await prisma.menuCategory.create({
      data: {
        dealerId,
        name: body.name,
        emoji: body.emoji || null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: { items: true },
    });
    return NextResponse.json(category, { status: 201 });
  }

  if (body.type === "item") {
    const maxSort = await prisma.menuItem.aggregate({
      where: { categoryId: body.categoryId },
      _max: { sortOrder: true },
    });
    const item = await prisma.menuItem.create({
      data: {
        categoryId: body.categoryId,
        name: body.name,
        description: body.description || null,
        price: Number(body.price),
        imageUrl: body.imageUrl || null,
        badge: body.badge || null,
        available: body.available !== false,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(item, { status: 201 });
  }

  if (body.type === "option-group") {
    const maxSort = await prisma.optionGroup.aggregate({
      where: { menuItemId: body.menuItemId },
      _max: { sortOrder: true },
    });
    const group = await prisma.optionGroup.create({
      data: {
        menuItemId: body.menuItemId,
        title: body.title,
        minSelections: body.minSelections ?? 0,
        maxSelections: body.maxSelections ?? 1,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        presetId: body.presetId || null,
        options: body.presetId ? undefined : {
          create: (body.options || []).map((o: any, i: number) => ({
            name: o.name,
            priceDelta: o.priceDelta ?? 0,
            sortOrder: i,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(group, { status: 201 });
  }

  return NextResponse.json({ error: "type must be 'category', 'item', or 'option-group'" }, { status: 400 });
}

// PATCH — update category or item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json();

  if (body.type === "category" && body.categoryId) {
    const updated = await prisma.menuCategory.update({
      where: { id: body.categoryId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.emoji !== undefined && { emoji: body.emoji }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });
    return NextResponse.json(updated);
  }

  if (body.type === "item" && body.itemId) {
    const updated = await prisma.menuItem.update({
      where: { id: body.itemId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.badge !== undefined && { badge: body.badge }),
        ...(body.available !== undefined && { available: body.available }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });
    return NextResponse.json(updated);
  }

  if (body.type === "option-group" && body.id) {
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.minSelections !== undefined) updateData.minSelections = body.minSelections;
    if (body.maxSelections !== undefined) updateData.maxSelections = body.maxSelections;
    if (body.presetId !== undefined) updateData.presetId = body.presetId || null;
    await prisma.optionGroup.update({ where: { id: body.id }, data: updateData });
    // Only apply inline options if no preset is linked
    if (body.options && !body.presetId) {
      await prisma.optionChoice.deleteMany({ where: { optionGroupId: body.id } });
      await prisma.optionChoice.createMany({
        data: body.options.map((o: any, i: number) => ({
          optionGroupId: body.id, name: o.name, priceDelta: o.priceDelta ?? 0, available: o.available ?? true, sortOrder: i,
        })),
      });
    }
    // If switching to preset, wipe inline options
    if (body.presetId) {
      await prisma.optionChoice.deleteMany({ where: { optionGroupId: body.id } });
    }
    const result = await prisma.optionGroup.findUnique({ where: { id: body.id }, include: { options: { orderBy: { sortOrder: "asc" } } } });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// DELETE — delete category or item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const targetId = searchParams.get("targetId");

  if (!type || !targetId) return NextResponse.json({ error: "Falta type y targetId" }, { status: 400 });

  if (type === "category") {
    await prisma.menuCategory.delete({ where: { id: targetId } });
  } else if (type === "item") {
    await prisma.menuItem.delete({ where: { id: targetId } });
  } else if (type === "option-group") {
    await prisma.optionGroup.delete({ where: { id: targetId } });
  }

  return NextResponse.json({ success: true });
}
