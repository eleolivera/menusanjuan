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
import { rewardsFlag, upsertCustomerByPhone, applyPendingRedemption, attachRedemptionToOrder } from "@/lib/rewards";
import { isValidPhone } from "@/lib/phone";
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
    const paymentStatus = paymentReceiptUrl ? "PAID_UNVERIFIED" : "UNPAID";

    // Rewards: upsert the phone-keyed Customer record so the order links to it
    // for punch accrual. Best-effort — never block order creation if it fails.
    let customerId: string | null = null;
    if (rewardsFlag() && customerPhone && isValidPhone(customerPhone)) {
      try {
        const customer = await upsertCustomerByPhone(customerPhone, customerName);
        customerId = customer.id;
      } catch (err) {
        console.error("Customer upsert failed (rewards):", err);
      }
    }

    // Auto-apply pending Redemption at checkout. Runs BEFORE createOrder so
    // the free reward line is included in the saved items JSON. Gated on
    // Customer.googleSub (fraud: prevents phone-hijacking of someone else's
    // reward). Best-effort — any failure means order still ships without
    // the reward (redemption stays READY for the next attempt).
    let effectiveItems = items;
    let effectiveTotal = total;
    let pendingRedemptionId: string | null = null;
    if (customerId) {
      try {
        const dealer = await prisma.dealer.findUnique({
          where: { slug: restauranteSlug },
          select: { id: true },
        });
        if (dealer) {
          const result = await applyPendingRedemption({
            customerId,
            dealerId: dealer.id,
            dealerSlug: restauranteSlug,
            cartItems: items,
          });
          if (result.redemptionId) {
            effectiveItems = result.items as typeof items;
            effectiveTotal = computeCartTotal(effectiveItems);   // free line = $0 so total unchanged, but recompute for correctness
            pendingRedemptionId = result.redemptionId;
          }
        }
      } catch (err) {
        console.error("applyPendingRedemption failed:", err);
      }
    }

    const order = await createOrder({
      restauranteSlug,
      customerName,
      customerPhone,
      customerAddress: customerAddress || "",
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      items: effectiveItems,
      total: effectiveTotal,
      notes: notes || "",
      deliveryMethod: deliveryMethod || "delivery",
      deliveryFee: deliveryFee || 0,
      paymentIntent,
      paymentReceiptUrl,
      paymentStatus,
      customerId,
    });

    // Attach the Redemption to this Order + spend the punches. Best-effort:
    // failure here means the reward line stays in the order (customer wins)
    // but Redemption.orderId doesn't get written — cleanup deferred.
    if (pendingRedemptionId) {
      try {
        await attachRedemptionToOrder(pendingRedemptionId, order.id);
      } catch (err) {
        console.error("attachRedemptionToOrder failed:", err);
      }
    }

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
