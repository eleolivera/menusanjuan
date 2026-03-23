import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus, markWhatsAppSent } from "@/lib/orders-store";
import type { OrderStatus } from "@/lib/orders-store";

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

  return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
}
