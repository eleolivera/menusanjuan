import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { dispatchOrder } from "@/lib/dispatch";

// Reason → HTTP status mapping. Reasons come from lib/dispatch.ts.
const REASON_STATUS: Record<string, number> = {
  manual_mode: 400,
  not_delivery: 400,
  already_delivered: 409,
  already_dispatched: 409,   // if dispatch.ts flags an in-flight PENDING offer
  no_drivers_available: 503,
  not_your_order: 403,
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      restauranteSlug: true,
      deliveryMethod: true,
      status: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.restauranteSlug !== dealer.slug) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }
  if (dealer.deliveryMode === "MANUAL") {
    return NextResponse.json({ ok: false, reason: "manual_mode" }, { status: 400 });
  }
  if (order.deliveryMethod !== "delivery") {
    return NextResponse.json({ ok: false, reason: "not_delivery" }, { status: 400 });
  }
  if (order.status === "DELIVERED") {
    return NextResponse.json({ ok: false, reason: "already_delivered" }, { status: 409 });
  }

  const result = await dispatchOrder(orderId);
  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  const status = REASON_STATUS[result.reason ?? ""] ?? 400;
  return NextResponse.json(result, { status });
}
