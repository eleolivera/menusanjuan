import { NextRequest, NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createOrder, type OrderItem, type OrderChannel, type PaymentMethod } from "@/lib/orders-store";

const VALID_CHANNELS: OrderChannel[] = ["DINE_IN", "COUNTER", "ONLINE"];
const VALID_PAYMENTS: PaymentMethod[] = ["cash", "card", "transfer", "mercadopago"];

// POST — create POS order (pre-paid, in-house)
// Allows: restaurant owner OR admin
export async function POST(request: NextRequest) {
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
  if (!paymentMethod || !VALID_PAYMENTS.includes(paymentMethod)) return NextResponse.json({ error: "Metodo de pago invalido" }, { status: 400 });
  if (channel === "DINE_IN" && !tableNumber?.trim()) return NextResponse.json({ error: "Falta numero de mesa" }, { status: 400 });

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

  // Compute total respecting price overrides (rounded to whole pesos)
  const total = Math.round(items.reduce((s, it) => {
    const linePrice = it.priceOverride !== undefined ? it.priceOverride : (it.unitPrice + (it.optionsDelta || 0));
    return s + linePrice * it.quantity;
  }, 0));

  // Cash validation: must cover total
  let cashChange: number | null = null;
  let cashTenderedNorm: number | null = null;
  if (paymentMethod === "cash") {
    if (cashTendered === undefined || cashTendered === null || cashTendered < 0) {
      return NextResponse.json({ error: "Falta monto recibido" }, { status: 400 });
    }
    if (total > 0 && cashTendered < total) {
      return NextResponse.json({ error: "Monto recibido menor al total" }, { status: 400 });
    }
    cashTenderedNorm = Math.round(cashTendered);
    cashChange = Math.max(0, cashTenderedNorm - total);
  }

  // Pre-pay flow: paymentStatus = PAID, status = PROCESSING (in cocina)
  const order = await createOrder({
    restauranteSlug: restauranteSlug!,
    customerName: customerName || (channel === "DINE_IN" ? `Mesa ${tableNumber || "?"}` : "Mostrador"),
    customerPhone: customerPhone || "",
    customerAddress: customerAddress || "",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    items,
    total,
    notes,
    deliveryMethod: channel === "DINE_IN" ? "dine-in" : "pickup",
    deliveryFee: 0,
    channel,
    tableNumber: tableNumber || null,
    paymentMethod,
    paymentStatus: "PAID",
    cashTendered: cashTenderedNorm,
    cashChange,
    source: source || "pos-tablet",
    initialStatus: "PROCESSING",
  });

  // Save table to suggestions for autocomplete
  if (tableNumber && channel === "DINE_IN") {
    try {
      const existingDealer = await prisma.dealer.findUnique({ where: { slug: restauranteSlug! }, select: { tableSuggestions: true } });
      const current = ((existingDealer?.tableSuggestions as string[]) || []).filter((t) => t !== tableNumber);
      const updated = [tableNumber, ...current].slice(0, 30);
      await prisma.dealer.update({ where: { slug: restauranteSlug! }, data: { tableSuggestions: updated } });
    } catch {}
  }

  return NextResponse.json(order);
}
