import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

// GET — list categories with items for the logged-in restaurant
export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const categories = await prisma.menuCategory.findMany({
    where: { dealerId: dealer.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(categories);
}

// POST — create a new category
export async function POST(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { name, emoji } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const maxSort = await prisma.menuCategory.aggregate({
    where: { dealerId: dealer.id },
    _max: { sortOrder: true },
  });

  const category = await prisma.menuCategory.create({
    data: {
      dealerId: dealer.id,
      name: name.trim(),
      emoji: emoji || null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    include: { items: true },
  });

  return NextResponse.json(category, { status: 201 });
}

// PATCH — update a category
export async function PATCH(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { id, name, emoji, sortOrder } = body;

  const category = await prisma.menuCategory.findFirst({
    where: { id, dealerId: dealer.id },
  });
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

  const updated = await prisma.menuCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(emoji !== undefined && { emoji }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
    include: { items: true },
  });

  return NextResponse.json(updated);
}

// DELETE — delete a category and its items
export async function DELETE(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const category = await prisma.menuCategory.findFirst({
    where: { id, dealerId: dealer.id },
  });
  if (!category) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await prisma.menuCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
