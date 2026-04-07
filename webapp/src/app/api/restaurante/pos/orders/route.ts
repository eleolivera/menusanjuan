import { NextRequest, NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createOrder, type OrderItem, type OrderChannel, type PaymentMethod } from "@/lib/orders-store";
import { computeCartTotal } from "@/lib/money";

const VALID_CHANNELS: OrderChannel[] = ["DINE_IN", "COUNTER", "ONLINE"];
const VALID_PAYMENTS: PaymentMethod[] = ["cash", "card", "transfer", "mercadopago"];

// POST — create POS order (pre-paid, in-house)
// Allows: restaurant owner OR admin
export async function POST(request: NextRequest) {
  try {
  // Read body ONCE
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  // Auth: restaurant owner first, then admin fallback
  const dealer = await getRestauranteFromSession();
  let restauranteSlug: string | null = dealer?.slug || null;

  if (!restauranteSlug) {
    const adminSession = await getAdminSession();
    if (!adminSession) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (!body.restauranteSlug) return NextResponse.json({ error: "Falta restauranteSlug" }, { status: 400 });
    restauranteSlug = body.restauranteSlug;
  }

  const {
    items,
    channel,
    tableNumber,
    paymentMethod,
    cashTendered,
    customerName,
    customerPhone,
    customerAddress,
    latitude,
    longitude,
    notes,
    source,
  } = body as {
    items: OrderItem[];
    channel: OrderChannel;
    tableNumber?: string;
    paymentMethod: PaymentMethod;
    cashTendered?: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
    source?: string;
  };

  // ─── Validation ───
  if (!items?.length) return NextResponse.json({ error: "Sin items" }, { status: 400 });
  if (!channel || !VALID_CHANNELS.includes(channel)) return NextResponse.json({ error: "Canal invalido" }, { status: 400 });
  if (channel === "DINE_IN" && !tableNumber?.trim()) return NextResponse.json({ error: "Falta numero de mesa" }, { status: 400 });
  // Mesa is post-pay, no payment method needed at creation. Mostrador requires it.
  if (channel === "COUNTER") {
    if (!paymentMethod || !VALID_PAYMENTS.includes(paymentMethod)) {
      return NextResponse.json({ error: "Metodo de pago invalido" }, { status: 400 });
    }
  }

  // Multi-tenant safety: verify all menuItemIds belong to this restaurant
  const itemIds = items.map((it) => it.menuItemId).filter(Boolean);
  if (itemIds.length > 0) {
    const validItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, category: { dealer: { slug: restauranteSlug! } } },
      select: { id: true },
    });
    const validIds = new Set(validItems.map((v) => v.id));
    const invalidIds = itemIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) return NextResponse.json({ error: "Items no pertenecen al restaurante" }, { status: 400 });
  }

  // Reject negative price overrides
  for (const it of items) {
    if (it.priceOverride !== undefined && it.priceOverride !== null && it.priceOverride < 0) {
      return NextResponse.json({ error: "Precio override invalido" }, { status: 400 });
    }
  }

  // For mesa: check no other open mesa has the same table number
  if (channel === "DINE_IN") {
    const existingTable = await prisma.order.findFirst({
      where: {
        restauranteSlug: restauranteSlug!,
        channel: "DINE_IN",
        paymentStatus: "UNPAID",
        status: { notIn: ["CANCELLED", "DELIVERED"] },
        tableNumber: tableNumber!.trim(),
      },
      select: { id: true, orderNumber: true },
    });
    if (existingTable) {
      return NextResponse.json({
        error: `Mesa ${tableNumber} ya esta abierta (${existingTable.orderNumber}). Agrega items a la mesa existente.`,
        existingOrderId: existingTable.id,
      }, { status: 409 });
    }
  }

  // Stamp items with addedAt for batched kitchen tickets
  const now = new Date().toISOString();
  const stampedItems = items.map((it) => ({ ...it, addedAt: now }));

  // Compute total via shared helper (rounded to whole pesos)
  const total = computeCartTotal(stampedItems);

  // Cash validation: must cover total. If total is 0, cashTendered is meaningless → null.
  // Mesa skips cash validation (post-pay) — only mostrador with cash needs it.
  let cashChange: number | null = null;
  let cashTenderedNorm: number | null = null;
  if (channel === "COUNTER" && paymentMethod === "cash" && total > 0) {
    if (cashTendered === undefined || cashTendered === null || cashTendered < 0) {
      return NextResponse.json({ error: "Falta monto recibido" }, { status: 400 });
    }
    if (cashTendered < total) {
      return NextResponse.json({ error: "Monto recibido menor al total" }, { status: 400 });
    }
    cashTenderedNorm = Math.round(cashTendered);
    cashChange = Math.max(0, cashTenderedNorm - total);
  }

  // Mesa = post-pay (UNPAID, kept open for adding items, cobrar later)
  // Mostrador = pre-pay (PAID immediately)
  const isPrePay = channel === "COUNTER";

  const order = await createOrder({
    restauranteSlug: restauranteSlug!,
    customerName: customerName || (channel === "DINE_IN" ? `Mesa ${tableNumber || "?"}` : "Mostrador"),
    customerPhone: customerPhone || "",
    customerAddress: customerAddress || "",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    items: stampedItems,
    total,
    notes,
    deliveryMethod: channel === "DINE_IN" ? "dine-in" : "pickup",
    deliveryFee: 0,
    channel,
    tableNumber: tableNumber || null,
    paymentMethod: isPrePay ? paymentMethod : null,
    paymentStatus: isPrePay ? "PAID" : "UNPAID",
    cashTendered: isPrePay ? cashTenderedNorm : null,
    cashChange: isPrePay ? cashChange : null,
    source: source || "pos-tablet",
    initialStatus: "PROCESSING",
  });

  // Save table to suggestions for autocomplete (atomic via transaction)
  if (tableNumber && channel === "DINE_IN") {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.dealer.findUnique({ where: { slug: restauranteSlug! }, select: { tableSuggestions: true } });
        const current = ((existing?.tableSuggestions as string[]) || []).filter((t) => t !== tableNumber);
        const updated = [tableNumber, ...current].slice(0, 30);
        await tx.dealer.update({ where: { slug: restauranteSlug! }, data: { tableSuggestions: updated } });
      });
    } catch {}
  }

    return NextResponse.json(order);
  } catch (err: any) {
    console.error("POS order create error:", err?.message, err?.stack);
    return NextResponse.json({ error: err?.message || "Error del servidor" }, { status: 500 });
  }
}
