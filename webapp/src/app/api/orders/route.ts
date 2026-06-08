import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getOrdersByRestaurante,
  getOrdersByDateRange,
  getBusinessDayStart,
  getBusinessDayEnd,
  getAllOrders,
} from "@/lib/orders-store";
import { notifyRestaurantOfNewOrder } from "@/lib/order-notification";
import { computeCartTotal } from "@/lib/money";
import { prisma } from "@/lib/prisma";

// POST — create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      restauranteSlug,
      customerName,
      customerPhone,
      customerAddress,
      items,
      notes,
      latitude,
      longitude,
      deliveryMethod,
      deliveryFee,
      paymentIntent: rawPaymentIntent,
      paymentReceiptUrl: rawReceiptUrl,
    } = body;

    if (!restauranteSlug || !customerName || !customerPhone || !items?.length) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // ALWAYS recompute total server-side from items — never trust client total.
    // Previously clients sometimes sent (items + deliveryFee) bundled together as total,
    // which then double-counted with the separate deliveryFee column.
    const total = computeCartTotal(items);
    if (total <= 0) {
      return NextResponse.json({ error: "Total inválido" }, { status: 400 });
    }

    // Sanitize paymentIntent / paymentReceiptUrl — both are optional, but if the
    // client uploads a comprobante at checkout we record the intent it claims
    // to pay with so the cashier can compare against the receipt later.
    const VALID_INTENTS = ["cash", "transfer", "mercadopago"] as const;
    const paymentIntent = VALID_INTENTS.includes(rawPaymentIntent) ? rawPaymentIntent : null;
    // Only accept receipt URLs from our own R2 bucket (prevents abuse).
    const paymentReceiptUrl =
      typeof rawReceiptUrl === "string" &&
      rawReceiptUrl.startsWith("https://images.menusanjuan.com/")
        ? rawReceiptUrl
        : null;

    // "Modo confiar": when the dealer opts in, every order auto-lands as PAID
    // regardless of the customer's intent. We tag paymentAssumed=true so the
    // owner can audit later which orders had no real validation step.
    const dealer = await prisma.dealer.findUnique({
      where: { slug: restauranteSlug },
      select: { assumePaymentsAuto: true },
    });
    const assume = !!dealer?.assumePaymentsAuto;

    const paymentStatus = assume
      ? "PAID"
      : (paymentReceiptUrl ? "PAID_UNVERIFIED" : "UNPAID");
    // When assuming PAID, also lock in the method (use the customer's stated
    // intent if any, else "cash" as the safe default) so the OrderCard shows
    // something useful next to the "✓ Pagado" pill.
    const paymentMethod = assume ? (paymentIntent ?? "cash") : null;

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
      deliveryMethod: deliveryMethod || "delivery",
      deliveryFee: deliveryFee || 0,
      paymentIntent,
      paymentReceiptUrl,
      paymentStatus,
      paymentMethod,
      paymentAssumed: assume,
    });

    // Fire-and-forget email notification to restaurant owner
    notifyRestaurantOfNewOrder(order).catch(() => {});

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
