import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getOrdersByRestaurante,
  getOrdersByDateRange,
  getBusinessDayStart,
  getBusinessDayEnd,
  getAllOrders,
} from "@/lib/orders-store";

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

// GET — list orders (optionally by restaurante slug + date)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurante = searchParams.get("restaurante");
  const dateParam = searchParams.get("date"); // YYYY-MM-DD for specific business day
  const allDays = searchParams.get("all") === "true";

  if (!restaurante) {
    const orders = await getAllOrders();
    return NextResponse.json(orders);
  }

  if (allDays) {
    const orders = await getOrdersByRestaurante(restaurante, false);
    return NextResponse.json(orders);
  }

  if (dateParam) {
    // Specific business day: parse date, get business day range
    // dateParam is YYYY-MM-DD in AR time, business day starts at 8am AR
    const targetDate = new Date(`${dateParam}T11:00:00.000Z`); // 8am AR = 11:00 UTC
    const start = getBusinessDayStart(targetDate);
    const end = getBusinessDayEnd(targetDate);
    const orders = await getOrdersByDateRange(restaurante, start, end);
    return NextResponse.json(orders);
  }

  // Default: today's business day
  const orders = await getOrdersByRestaurante(restaurante, true);
  return NextResponse.json(orders);
}
