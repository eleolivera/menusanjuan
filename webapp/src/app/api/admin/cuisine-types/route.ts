import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// GET — list all cuisine types with restaurant counts
export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const types = await prisma.cuisineType.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { dealers: true } } },
  });

  return NextResponse.json(types.map(t => ({
    id: t.id,
    label: t.label,
    emoji: t.emoji,
    sortOrder: t.sortOrder,
    restaurantCount: t._count.dealers,
  })));
}

// POST — create new cuisine type
export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { label, emoji } = await request.json();
    if (!label?.trim()) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });

    const maxSort = await prisma.cuisineType.aggregate({ _max: { sortOrder: true } });
    const type = await prisma.cuisineType.create({
      data: {
        label: label.trim(),
        emoji: emoji || "🍽️",
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(type, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") return NextResponse.json({ error: "Ya existe ese tipo" }, { status: 409 });
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

// PATCH — update or reorder
export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();

  // Bulk reorder
  if (body.reorder) {
    for (const item of body.reorder) {
      await prisma.cuisineType.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      });
    }
    return NextResponse.json({ success: true });
  }

  // Single update
  if (body.id) {
    const updated = await prisma.cuisineType.update({
      where: { id: body.id },
      data: {
        ...(body.label !== undefined && { label: body.label }),
        ...(body.emoji !== undefined && { emoji: body.emoji }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Falta id" }, { status: 400 });
}

// DELETE — remove cuisine type
export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Check if it's "General" — don't delete
  const type = await prisma.cuisineType.findUnique({ where: { id } });
  if (type?.label === "General") return NextResponse.json({ error: "No se puede eliminar 'General'" }, { status: 400 });

  // Delete join records first, then the type
  await prisma.dealerCuisineType.deleteMany({ where: { cuisineTypeId: id } });
  await prisma.cuisineType.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
