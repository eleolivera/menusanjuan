import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

// POST — create a menu item
export async function POST(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { categoryId, name, description, price, imageUrl, badge, available } = body;

  if (!categoryId || !name?.trim() || !price) {
    return NextResponse.json({ error: "Nombre, categoría y precio son obligatorios" }, { status: 400 });
  }

  // Verify category belongs to this dealer
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, dealerId: dealer.id },
  });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

  const maxSort = await prisma.menuItem.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });

  const item = await prisma.menuItem.create({
    data: {
      categoryId,
      name: name.trim(),
      description: description || null,
      price: Number(price),
      imageUrl: imageUrl || null,
      badge: badge || null,
      available: available !== false,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

// PATCH — update a menu item
export async function PATCH(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { id, name, description, price, imageUrl, badge, available, sortOrder, categoryId } = body;

  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Verify item belongs to this dealer
  const item = await prisma.menuItem.findFirst({
    where: { id },
    include: { category: true },
  });
  if (!item || item.category.dealerId !== dealer.id) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: Number(price) }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(badge !== undefined && { badge }),
      ...(available !== undefined && { available }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(categoryId !== undefined && { categoryId }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE — delete a menu item
export async function DELETE(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const item = await prisma.menuItem.findFirst({
    where: { id },
    include: { category: true },
  });
  if (!item || item.category.dealerId !== dealer.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
