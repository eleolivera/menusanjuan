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
  const { id, name, description, price, imageUrl, badge, available, sortOrder, categoryId, components } = body;

  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Verify item belongs to this dealer
  const item = await prisma.menuItem.findFirst({
    where: { id },
    include: { category: true },
  });
  if (!item || item.category.dealerId !== dealer.id) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  // Promo components reconciliation — if the client sent `components`, replace
  // the entire set. Validates that every child belongs to the same dealer and
  // that there are no cycles (a child that eventually points back to this item).
  if (components !== undefined) {
    if (!Array.isArray(components)) {
      return NextResponse.json({ error: "components debe ser un array" }, { status: 400 });
    }
    type ComponentInput = { childItemId: string; label?: string | null; sortOrder?: number };
    const inputs = components as ComponentInput[];

    // Verify all children exist and belong to this dealer.
    // IMPORTANT: dedupe before the query — a promo like "2 Pachatas + Papas"
    // legitimately references the same childItemId twice. The findMany returns
    // each item ONCE, so comparing length against `inputs.length` would falsely
    // fail on every multi-pachata promo and silently 400 the save.
    const childIds = inputs.map((c) => c.childItemId).filter(Boolean);
    if (childIds.length !== inputs.length) {
      return NextResponse.json({ error: "Cada componente necesita un childItemId" }, { status: 400 });
    }
    const uniqueChildIds = Array.from(new Set(childIds));
    const children = await prisma.menuItem.findMany({
      where: { id: { in: uniqueChildIds } },
      include: { category: true },
    });
    if (children.length !== uniqueChildIds.length) {
      return NextResponse.json({ error: "Un componente referencia un item que no existe" }, { status: 400 });
    }
    for (const child of children) {
      if (child.category.dealerId !== dealer.id) {
        return NextResponse.json({ error: "Un componente apunta a un item de otro restaurante" }, { status: 403 });
      }
    }

    // Cycle detection: BFS from each proposed child to make sure none of them
    // (or their transitive components) reference `id` (the parent). Bounded by
    // the menu's component graph depth, ~30 items in practice = trivial cost.
    const visited = new Set<string>();
    const queue: string[] = [...childIds];
    while (queue.length > 0) {
      const next = queue.shift()!;
      if (next === id) {
        return NextResponse.json(
          { error: "No se puede agregar este combo dentro de sí mismo (ciclo detectado)." },
          { status: 400 },
        );
      }
      if (visited.has(next)) continue;
      visited.add(next);
      const deeper = await prisma.menuItemComponent.findMany({
        where: { parentItemId: next },
        select: { childItemId: true },
      });
      for (const d of deeper) queue.push(d.childItemId);
    }

    // Wipe & re-insert in one transaction. Cleaner than diffing; component
    // rows are tiny and the typical promo has 2-5 components.
    await prisma.$transaction([
      prisma.menuItemComponent.deleteMany({ where: { parentItemId: id } }),
      ...inputs.map((c, i) =>
        prisma.menuItemComponent.create({
          data: {
            parentItemId: id,
            childItemId: c.childItemId,
            label: c.label?.trim() || null,
            sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : i,
          },
        })
      ),
    ]);
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
    include: {
      componentsOf: { orderBy: { sortOrder: "asc" }, include: { childItem: true } },
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
