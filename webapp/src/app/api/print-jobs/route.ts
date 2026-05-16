import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { buildOrderTicket, type EscOrder } from "@/lib/escpos-ticket";

const STALE_MS = 3 * 60 * 1000;

/**
 * POST /api/print-jobs
 * Body: { orderId: string }
 *
 * Called by OrderCard's "Imprimir comanda" button. Builds the ESC/POS payload
 * server-side and enqueues it on the resta's online agent. If no agent is
 * paired or all are offline, returns 409 — the client falls back to the
 * existing iframe browser print.
 */
export async function POST(req: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = body.orderId as string | undefined;
  if (!orderId) return NextResponse.json({ error: "Falta orderId" }, { status: 400 });

  // Find an online agent for this dealer (lastSeenAt < 3 min ago)
  const cutoff = new Date(Date.now() - STALE_MS);
  const agent = await prisma.printAgent.findFirst({
    where: {
      dealerId: dealer.id,
      pairedAt: { not: null },
      lastSeenAt: { gte: cutoff },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  if (!agent) {
    return NextResponse.json(
      { error: "No hay agente en linea", code: "NO_AGENT" },
      { status: 409 },
    );
  }

  // Load the order + dealer for the payload
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.restauranteSlug !== dealer.slug) {
    return NextResponse.json({ error: "Pedido de otro restaurante" }, { status: 403 });
  }

  const ticketBase = process.env.NEXT_PUBLIC_BASE_URL || "https://menusanjuan.com";
  const driverUrl = order.driverAccessToken
    ? `${ticketBase}/d/${order.id}?t=${order.driverAccessToken}`
    : null;

  const escOrder: EscOrder = {
    orderNumber: order.orderNumber,
    restaurantName: dealer.name,
    restaurantPhone: dealer.phone,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress || "",
    items: order.items as any,
    total: order.total,
    deliveryFee: order.deliveryFee || 0,
    deliveryMethod: order.deliveryMethod || "",
    notes: order.notes || "",
    paymentStatus: (order.paymentStatus as "PAID" | "UNPAID"),
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt.toISOString(),
  };
  const payload = buildOrderTicket(escOrder, driverUrl);

  const job = await prisma.printJob.create({
    data: { agentId: agent.id, orderId: order.id, kind: "ORDER", payload },
  });

  return NextResponse.json({ jobId: job.id, agentId: agent.id, agentName: agent.name });
}
