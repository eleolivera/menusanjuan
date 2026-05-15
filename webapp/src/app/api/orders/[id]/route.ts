import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus, markWhatsAppSent } from "@/lib/orders-store";
import type { OrderStatus } from "@/lib/orders-store";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

const VALID_STATUSES: OrderStatus[] = ["GENERATED", "PAID", "PROCESSING", "DELIVERED", "CANCELLED"];

// GET — single order
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  return NextResponse.json(order);
}

// PATCH — update order status or mark whatsapp sent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (body.whatsappSent) {
    const order = await markWhatsAppSent(id);
    if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    return NextResponse.json(order);
  }

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const order = await updateOrderStatus(id, body.status);
    if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    return NextResponse.json(order);
  }

  // Owner-only: toggle paymentStatus
  if (body.paymentStatus === "PAID" || body.paymentStatus === "UNPAID") {
    const dealer = await getRestauranteFromSession();
    if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const existing = await prisma.order.findUnique({ where: { id }, select: { restauranteSlug: true } });
    if (!existing) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    if (existing.restauranteSlug !== dealer.slug) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const wantPaid = body.paymentStatus === "PAID";
    await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: body.paymentStatus,
        paidAt: wantPaid ? new Date() : null,
        ...(body.paymentMethod && wantPaid ? { paymentMethod: body.paymentMethod } : {}),
      },
    });
    const fresh = await getOrder(id);
    return NextResponse.json(fresh);
  }

  return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
}
