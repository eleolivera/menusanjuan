import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/orders/driver/[id]?t=X
// Returns full order details for the delivery driver to act on.
// Auth: the driverAccessToken is the only auth — knowing it grants read + mark-delivered.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t");

  if (!id || !token) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      dealer: { select: { name: true, phone: true, slug: true, logoUrl: true } },
    },
  });

  if (!order || order.driverAccessToken !== token) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    restaurantName: order.dealer?.name || order.restauranteSlug,
    restaurantLogo: order.dealer?.logoUrl || null,
    restauranteSlug: order.restauranteSlug,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    paymentMethod: order.paymentMethod,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress || "",
    latitude: order.latitude,
    longitude: order.longitude,
    items: order.items,
    total: order.total,
    deliveryFee: order.deliveryFee,
    deliveryMethod: order.deliveryMethod,
    notes: order.notes || "",
    createdAt: order.createdAt.toISOString(),
  });
}

// PATCH /api/orders/driver/[id]?t=X
// body: { action: "mark_delivered", paymentMethod?, cashTendered? }
// If paymentMethod is provided, also mark the order as PAID with paidAt = now.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t");
  const body = await request.json().catch(() => ({}));
  const action = body?.action as string | undefined;
  const paymentMethod = body?.paymentMethod as string | undefined;
  const cashTendered = typeof body?.cashTendered === "number" ? body.cashTendered : undefined;

  if (!id || !token) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true, driverAccessToken: true, status: true, paymentStatus: true,
      total: true, deliveryFee: true,
    },
  });

  if (!order || order.driverAccessToken !== token) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  if (action === "mark_delivered") {
    const validMethods = ["cash", "card", "transfer", "mercadopago"];
    const collecting = paymentMethod && validMethods.includes(paymentMethod);

    let cashChange: number | null = null;
    let cashTenderedNorm: number | null = null;
    if (collecting && paymentMethod === "cash") {
      const totalDue = (order.total || 0) + (order.deliveryFee || 0);
      if (cashTendered != null) {
        if (cashTendered < totalDue) {
          return NextResponse.json({ error: "Monto recibido menor al total" }, { status: 400 });
        }
        cashTenderedNorm = Math.round(cashTendered);
        cashChange = Math.max(0, cashTenderedNorm - totalDue);
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        ...(collecting && order.paymentStatus !== "PAID"
          ? {
              paymentStatus: "PAID",
              paidAt: new Date(),
              paymentMethod,
              ...(paymentMethod === "cash" && cashTenderedNorm != null
                ? { cashTendered: cashTenderedNorm, cashChange }
                : {}),
            }
          : {}),
      },
      select: { status: true, deliveredAt: true, paymentStatus: true, paidAt: true },
    });
    return NextResponse.json({
      status: updated.status,
      deliveredAt: updated.deliveredAt?.toISOString() ?? null,
      paymentStatus: updated.paymentStatus,
      paidAt: updated.paidAt?.toISOString() ?? null,
    });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
