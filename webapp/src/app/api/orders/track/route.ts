import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/orders/track?id=X&token=Y — public order tracking
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  if (!id || !token) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      dealer: {
        select: {
          name: true,
          phone: true,
          slug: true,
          logoUrl: true,
          mercadoPagoAlias: true,
          mercadoPagoCvu: true,
          bankInfo: true,
        },
      },
    },
  });

  if (!order || order.customerAccessToken !== token) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    orderNumber: order.orderNumber,
    restauranteSlug: order.restauranteSlug,
    restaurantName: order.dealer?.name || order.restauranteSlug,
    restaurantPhone: order.dealer?.phone || "",
    restaurantLogo: order.dealer?.logoUrl || null,
    status: order.status,
    customerName: order.customerName,
    items: order.items,
    total: order.total,
    deliveryMethod: order.deliveryMethod,
    deliveryFee: order.deliveryFee,
    notes: order.notes,
    whatsappSent: order.whatsappSent,
    // Payment state — surfaced so /mis-pedidos and /pagar can show the right UX
    paymentStatus: order.paymentStatus,
    paymentIntent: order.paymentIntent,
    paymentReceiptUrl: order.paymentReceiptUrl,
    paymentReceiptAt: order.paymentReceiptAt ? order.paymentReceiptAt.toISOString() : null,
    // Resta payment details — needed on /pagar so the customer can copy alias/CVU
    mercadoPagoAlias: order.dealer?.mercadoPagoAlias || null,
    mercadoPagoCvu: order.dealer?.mercadoPagoCvu || null,
    bankInfo: order.dealer?.bankInfo || null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  });
}
