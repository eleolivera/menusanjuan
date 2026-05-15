import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { prisma } from "@/lib/prisma";

// GET — list active (unpaid, not cancelled) POS orders for the current restaurant.
// Query param ?channel=DINE_IN | COUNTER to filter; default returns DINE_IN for backward compat.
export async function GET(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const channel = request.nextUrl.searchParams.get("channel") || "DINE_IN";
  const channels = channel === "ALL" ? ["DINE_IN", "COUNTER"] : [channel];

  const orders = await prisma.order.findMany({
    where: {
      restauranteSlug: dealer.slug,
      channel: { in: channels },
      paymentStatus: "UNPAID",
      status: { notIn: ["CANCELLED", "DELIVERED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    channel: o.channel,
    tableNumber: o.tableNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    total: o.total,
    items: o.items,
    createdAt: o.createdAt.toISOString(),
  })));
}
