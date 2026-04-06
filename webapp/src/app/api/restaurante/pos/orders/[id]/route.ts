import { NextRequest, NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { computeCartTotal } from "@/lib/money";
import type { OrderItem } from "@/lib/orders-store";

async function authedSlug(request: NextRequest): Promise<string | null> {
  const dealer = await getRestauranteFromSession();
  if (dealer?.slug) return dealer.slug;
  const admin = await getAdminSession();
  if (!admin) return null;
  const { searchParams } = new URL(request.url);
  return searchParams.get("slug");
}

// PATCH — append items, update total, or mark paid
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

    const slug = await authedSlug(request);
    if (!slug) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Verify the order belongs to this restaurant
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing || existing.restauranteSlug !== slug) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (existing.paymentStatus === "PAID" && body.action !== "pay") {
      return NextResponse.json({ error: "El pedido ya fue cobrado" }, { status: 400 });
    }

    // ─── Action: append items ───
    if (body.action === "append-items") {
      const newItems = body.items as OrderItem[];
      if (!newItems?.length) return NextResponse.json({ error: "Sin items" }, { status: 400 });

      // Multi-tenant check
      const itemIds = newItems.map((it) => it.menuItemId).filter(Boolean);
      const validItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds }, category: { dealer: { slug } } },
        select: { id: true },
      });
      const validIds = new Set(validItems.map((v) => v.id));
      if (itemIds.some((id) => !validIds.has(id))) {
        return NextResponse.json({ error: "Items no pertenecen al restaurante" }, { status: 400 });
      }

      const merged = [...((existing.items as unknown) as OrderItem[]), ...newItems];
      const newTotal = computeCartTotal(merged);

      const updated = await prisma.order.update({
        where: { id },
        data: { items: merged as any, total: newTotal },
      });
      return NextResponse.json(updated);
    }

    // ─── Action: mark paid ───
    if (body.action === "pay") {
      const { paymentMethod, cashTendered } = body;
      if (!paymentMethod) return NextResponse.json({ error: "Falta metodo de pago" }, { status: 400 });

      let cashChange: number | null = null;
      let cashTenderedNorm: number | null = null;
      if (paymentMethod === "cash" && existing.total > 0) {
        if (cashTendered === undefined || cashTendered === null || cashTendered < 0) {
          return NextResponse.json({ error: "Falta monto recibido" }, { status: 400 });
        }
        if (cashTendered < existing.total) {
          return NextResponse.json({ error: "Monto recibido menor al total" }, { status: 400 });
        }
        cashTenderedNorm = Math.round(cashTendered);
        cashChange = Math.max(0, cashTenderedNorm - existing.total);
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          paymentMethod,
          cashTendered: cashTenderedNorm,
          cashChange,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Action no valida" }, { status: 400 });
  } catch (err: any) {
    console.error("POS order PATCH error:", err?.message, err?.stack);
    return NextResponse.json({ error: err?.message || "Error del servidor" }, { status: 500 });
  }
}
