import { NextRequest, NextResponse } from "next/server";
import { createOrder, getOrdersByRestaurante, getAllOrders } from "@/lib/orders-store";

// POST — create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { restauranteSlug, customerName, customerPhone, customerAddress, items, total, notes, latitude, longitude } = body;

    if (!restauranteSlug || !customerName || !customerPhone || !items?.length || !total) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const order = await createOrder({
      restauranteSlug,
      customerName,
      customerPhone,
      customerAddress: customerAddress || "",
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      items,
      total,
      notes: notes || "",
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error("Error creating order:", err);
    return NextResponse.json({ error: "Error creando el pedido" }, { status: 500 });
  }
}

// GET — list orders (optionally by restaurante slug)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurante = searchParams.get("restaurante");
  const allDays = searchParams.get("all") === "true";

  const orders = restaurante
    ? await getOrdersByRestaurante(restaurante, !allDays)
    : await getAllOrders();
  return NextResponse.json(orders);
}
