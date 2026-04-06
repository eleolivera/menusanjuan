import { NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { prisma } from "@/lib/prisma";

// GET — list active (unpaid, not cancelled) dine-in orders for the current restaurant
export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: {
      restauranteSlug: dealer.slug,
      channel: "DINE_IN",
      paymentStatus: "UNPAID",
      status: { notIn: ["CANCELLED", "DELIVERED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    tableNumber: o.tableNumber,
    total: o.total,
    items: o.items,
    createdAt: o.createdAt.toISOString(),
  })));
}
