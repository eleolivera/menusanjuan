import { NextRequest, NextResponse } from "next/server";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createOrder, type OrderItem, type OrderChannel, type PaymentMethod } from "@/lib/orders-store";

// POST — create POS order (pre-paid, in-house)
// Allows: restaurant owner OR admin
export async function POST(request: NextRequest) {
  // Auth: either restaurant owner or admin
  const dealer = await getRestauranteFromSession();
  let restauranteSlug: string | null = dealer?.slug || null;

  if (!restauranteSlug) {
    // Try admin auth + slug from body
    const adminSession = await getAdminSession();
    if (!adminSession) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const peek = await request.clone().json().catch(() => ({}));
    if (!peek.restauranteSlug) return NextResponse.json({ error: "Falta restauranteSlug" }, { status: 400 });
    restauranteSlug = peek.restauranteSlug;
  }

  const body = await request.json();
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

  if (!items?.length) return NextResponse.json({ error: "Sin items" }, { status: 400 });
  if (!channel) return NextResponse.json({ error: "Falta channel" }, { status: 400 });
  if (!paymentMethod) return NextResponse.json({ error: "Falta metodo de pago" }, { status: 400 });

  // Compute total respecting price overrides
  const total = items.reduce((s, it) => {
    const linePrice = it.priceOverride !== undefined ? it.priceOverride : (it.unitPrice + (it.optionsDelta || 0));
    return s + linePrice * it.quantity;
  }, 0);

  // Cash change calculation
  let cashChange: number | null = null;
  if (paymentMethod === "cash" && cashTendered !== undefined && cashTendered !== null) {
    cashChange = Math.max(0, cashTendered - total);
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
    cashTendered: cashTendered ?? null,
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
