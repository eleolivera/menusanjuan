// Prisma-backed order store — persistent in PostgreSQL

import { prisma } from "./prisma";
import { OrderStatus as PrismaOrderStatus } from "@/generated/prisma/client";
import crypto from "crypto";

function generateAccessToken(): string {
  return crypto.randomBytes(6).toString("hex"); // 12 chars
}

export type OrderStatus = "GENERATED" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED";

export type OrderChannel = "ONLINE" | "DINE_IN" | "COUNTER";
export type PaymentMethod = "cash" | "card" | "transfer" | "mercadopago";
// PAID_UNVERIFIED: customer uploaded a comprobante; awaiting cashier validation.
export type PaymentStatus = "UNPAID" | "PAID_UNVERIFIED" | "PAID";
// What the customer indicated at checkout they planned to pay with. Stays
// stable even if a paymentReceiptUrl is uploaded later. paymentMethod is the
// final, cashier-confirmed value at payment time.
export type PaymentIntent = "cash" | "transfer" | "mercadopago";

export type OrderItem = {
  menuItemId: string;
  name: string;
  // FIXED: integer jar/unit count. PACKAGED: integer jars OF the chosen tier.
  // BY_WEIGHT: fractional weight (kg) — always paired with `weight` for the
  // authoritative value; `quantity` mirrors it for legacy display sites.
  quantity: number;
  unitPrice: number;
  total: number;
  note?: string;          // Per-item kitchen note (e.g. "sin cebolla"). Prints on the ticket and shows in OrderCard.
  priceOverride?: number; // POS: cashier-set price (can be 0 = free)
  overrideNote?: string;  // Required when priceOverride is set
  selectedOptions?: { group: string; choices: { name: string; priceDelta: number }[]; delta: number }[];
  optionsDelta?: number;
  /** Promo items only: per-slot customizations. Each slot's `optionsDelta` is
   * already included in the parent OrderItem's `optionsDelta` (and `total`). */
  componentSelections?: {
    componentId: string;
    childItemId: string;
    label: string;
    selectedOptions: { group: string; choices: { name: string; priceDelta: number }[]; delta: number }[];
    optionsDelta: number;
  }[];
  // Variable-pricing metadata. Present when the source MenuItem had
  // pricingMode ≠ FIXED. Absent on legacy orders → treated as FIXED.
  pricingMode?: "FIXED" | "PACKAGED" | "BY_WEIGHT";
  tierLabel?: string;    // PACKAGED display, e.g. "¼ kg"
  tierAmount?: number;   // PACKAGED, e.g. 0.25 (kg contents per jar)
  tierPrice?: number;    // PACKAGED, price of ONE jar at this tier — used by money.ts
  weight?: number;       // BY_WEIGHT actual weight (in weightUnit)
  weightUnit?: string;   // "kg" | "gr" | "L" — display
};

// Re-export money helpers from lib/money.ts (pure, no DB deps — usable in client components)
export { lineUnitPrice, lineTotal, computeCartTotal } from "./money";

export type Order = {
  id: string;
  orderNumber: string;
  restauranteSlug: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  latitude: number | null;
  longitude: number | null;
  items: OrderItem[];
  total: number;
  deliveryMethod: string;
  deliveryFee: number;
  notes: string;
  whatsappSent: boolean;
  customerAccessToken: string | null;
  driverAccessToken: string | null;
  deliveredAt: string | null;
  assignedDriver: {
    id: string;
    displayName: string;
    currentLat: number | null;
    currentLng: number | null;
  } | null;
  latestOffer: {
    id: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";
    offeredAt: string;
    expiresAt: string;
    distanceKm: number | null;
  } | null;
  // POS fields
  channel: OrderChannel;
  tableNumber: string | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  paymentIntent: PaymentIntent | null;
  paidAt: string | null;
  cashTendered: number | null;
  cashChange: number | null;
  paymentReceiptUrl: string | null;
  paymentReceiptAt: string | null;
  paymentAssumed: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Business Day Logic ───
// Business day = 8:00 AM to 5:59 AM next day (Argentina UTC-3)
// Orders after midnight until 6am count as previous business day

const BUSINESS_DAY_START_HOUR = 8; // 8am AR
const BUSINESS_DAY_END_HOUR = 6;   // 6am AR next day

// Get business day start for a given date (or now)
export function getBusinessDayStart(date?: Date): Date {
  const now = date || new Date();
  // Convert to AR time
  const arTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const arHour = arTime.getUTCHours();

  let dayDate: string;
  if (arHour < BUSINESS_DAY_END_HOUR) {
    // Before 6am AR → belongs to previous business day
    const prevDay = new Date(arTime.getTime() - 24 * 60 * 60 * 1000);
    dayDate = prevDay.toISOString().split("T")[0];
  } else {
    dayDate = arTime.toISOString().split("T")[0];
  }

  // Business day starts at 8am AR = 11:00 UTC
  return new Date(`${dayDate}T${String(BUSINESS_DAY_START_HOUR + 3).padStart(2, "0")}:00:00.000Z`);
}

// Get business day end (6am AR next day = 9:00 UTC next day)
export function getBusinessDayEnd(date?: Date): Date {
  const start = getBusinessDayStart(date);
  // End is next day at 6am AR = start day + 22 hours (8am to 6am = 22h)
  return new Date(start.getTime() + 22 * 60 * 60 * 1000);
}

// Get business day label in AR timezone
export function getBusinessDayLabel(date?: Date): string {
  const start = getBusinessDayStart(date);
  const arDate = new Date(start.getTime() - 3 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000);
  return arDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Get date range for various periods
export function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = getBusinessDayStart(now);
  const todayEnd = getBusinessDayEnd(now);

  switch (period) {
    case "today":
      return { start: todayStart, end: todayEnd };
    case "yesterday": {
      const yestDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { start: getBusinessDayStart(yestDate), end: getBusinessDayEnd(yestDate) };
    }
    case "week": {
      // Last 7 business days
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: getBusinessDayStart(weekAgo), end: todayEnd };
    }
    case "weekend": {
      // Find last Saturday
      const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const dayOfWeek = arNow.getUTCDay();
      const daysSinceSat = dayOfWeek >= 6 ? dayOfWeek - 6 : dayOfWeek + 1;
      const saturday = new Date(now.getTime() - daysSinceSat * 24 * 60 * 60 * 1000);
      const monday = new Date(saturday.getTime() + 2 * 24 * 60 * 60 * 1000);
      return { start: getBusinessDayStart(saturday), end: getBusinessDayEnd(monday) };
    }
    case "month": {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: getBusinessDayStart(monthAgo), end: todayEnd };
    }
    default:
      return { start: todayStart, end: todayEnd };
  }
}

// ─── Order Number ───

function getOrderNumberPrefix(): string {
  const arNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const arHour = arNow.getUTCHours();
  let labelDate = arNow;
  if (arHour < BUSINESS_DAY_END_HOUR) {
    labelDate = new Date(arNow.getTime() - 24 * 60 * 60 * 1000);
  }
  const mm = String(labelDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(labelDate.getUTCDate()).padStart(2, "0");
  return `ORD-${mm}${dd}-`;
}

/**
 * Compute the next order number by querying max existing sequence for today.
 * More robust than count() because deleted orders or gaps don't break it.
 */
async function nextOrderNumber(restauranteSlug: string, attempt = 0): Promise<string> {
  const prefix = getOrderNumberPrefix();
  const todayStart = getBusinessDayStart();
  const todayEnd = getBusinessDayEnd();

  // orderNumber is GLOBALLY unique in the schema (@unique), so we have to
  // find the highest one across ALL restas today — not just this resta's. The
  // previous per-slug scoping caused new restas (with no prior orders) to
  // always generate ORD-MMDD-001, colliding with whichever resta posted first
  // that day. Result: a brand-new resta's customers got 500s on every order.
  // Scoping globally trades "consecutive numbers per-resta" (cosmetic) for
  // "every new resta works on day 1" (correctness). restauranteSlug is kept
  // in the signature to avoid changing call sites.
  void restauranteSlug;
  const latest = await prisma.order.findFirst({
    where: {
      createdAt: { gte: todayStart, lt: todayEnd },
      orderNumber: { startsWith: prefix },
    },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let nextSeq = 1;
  if (latest?.orderNumber) {
    const seqStr = latest.orderNumber.slice(prefix.length);
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq)) nextSeq = seq + 1;
  }

  // Add a small offset on retry to skip past races
  nextSeq += attempt;

  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

// ─── Mapping ───

function mapOrder(dbOrder: any): Order {
  return {
    id: dbOrder.id,
    orderNumber: dbOrder.orderNumber,
    restauranteSlug: dbOrder.restauranteSlug,
    status: dbOrder.status as OrderStatus,
    customerName: dbOrder.customerName,
    customerPhone: dbOrder.customerPhone,
    customerAddress: dbOrder.customerAddress || "",
    latitude: dbOrder.latitude,
    longitude: dbOrder.longitude,
    items: (dbOrder.items as OrderItem[]) || [],
    total: dbOrder.total,
    deliveryMethod: dbOrder.deliveryMethod || "delivery",
    deliveryFee: dbOrder.deliveryFee || 0,
    notes: dbOrder.notes || "",
    whatsappSent: dbOrder.whatsappSent,
    customerAccessToken: dbOrder.customerAccessToken || null,
    driverAccessToken: dbOrder.driverAccessToken || null,
    deliveredAt: dbOrder.deliveredAt ? dbOrder.deliveredAt.toISOString() : null,
    assignedDriver: dbOrder.assignedDriver
      ? {
          id: dbOrder.assignedDriver.id,
          displayName: dbOrder.assignedDriver.displayName,
          currentLat: dbOrder.assignedDriver.currentLat ?? null,
          currentLng: dbOrder.assignedDriver.currentLng ?? null,
        }
      : null,
    latestOffer: dbOrder.deliveryOffers?.[0]
      ? {
          id: dbOrder.deliveryOffers[0].id,
          status: dbOrder.deliveryOffers[0].status,
          offeredAt: dbOrder.deliveryOffers[0].offeredAt.toISOString(),
          expiresAt: dbOrder.deliveryOffers[0].expiresAt.toISOString(),
          distanceKm: dbOrder.deliveryOffers[0].distanceKm ?? null,
        }
      : null,
    channel: (dbOrder.channel || "ONLINE") as OrderChannel,
    tableNumber: dbOrder.tableNumber || null,
    paymentMethod: dbOrder.paymentMethod || null,
    paymentStatus: (dbOrder.paymentStatus || "UNPAID") as PaymentStatus,
    paymentIntent: (dbOrder.paymentIntent as PaymentIntent | null) || null,
    paidAt: dbOrder.paidAt ? dbOrder.paidAt.toISOString() : null,
    cashTendered: dbOrder.cashTendered,
    cashChange: dbOrder.cashChange,
    paymentReceiptUrl: dbOrder.paymentReceiptUrl || null,
    paymentReceiptAt: dbOrder.paymentReceiptAt ? dbOrder.paymentReceiptAt.toISOString() : null,
    paymentAssumed: !!dbOrder.paymentAssumed,
    source: dbOrder.source || null,
    createdAt: dbOrder.createdAt.toISOString(),
    updatedAt: dbOrder.updatedAt.toISOString(),
  };
}

// ─── CRUD ───

export async function createOrder(data: {
  restauranteSlug: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  items: OrderItem[];
  total: number;
  notes?: string;
  deliveryMethod?: string;
  deliveryFee?: number;
  // POS fields
  channel?: OrderChannel;
  tableNumber?: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus;
  paymentIntent?: PaymentIntent | null;
  cashTendered?: number | null;
  cashChange?: number | null;
  paymentReceiptUrl?: string | null;
  paymentAssumed?: boolean;
  source?: string | null;
  initialStatus?: OrderStatus; // For POS to skip GENERATED
  customerId?: string | null;  // Link to the Customer row for rewards
}): Promise<Order> {
  // Retry up to 5 times on unique constraint violation (concurrent inserts can race)
  const maxAttempts = 5;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderNumber = await nextOrderNumber(data.restauranteSlug, attempt);
    try {
      const accessToken = generateAccessToken();
      const driverToken = generateAccessToken();
      const dbOrder = await prisma.order.create({
        data: {
          orderNumber,
          customerAccessToken: accessToken,
          driverAccessToken: driverToken,
          restauranteSlug: data.restauranteSlug,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerAddress: data.customerAddress || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          items: data.items as any,
          total: data.total,
          notes: data.notes || null,
          deliveryMethod: data.deliveryMethod ?? "delivery",
          deliveryFee: data.deliveryFee ?? 0,
          channel: data.channel ?? "ONLINE",
          tableNumber: data.tableNumber ?? null,
          paymentMethod: data.paymentMethod ?? null,
          paymentStatus: data.paymentStatus ?? "UNPAID",
          paymentIntent: data.paymentIntent ?? null,
          paidAt: data.paymentStatus === "PAID" ? new Date() : null,
          cashTendered: data.cashTendered ?? null,
          cashChange: data.cashChange ?? null,
          // If the customer uploaded a comprobante at checkout-time, persist
          // it + timestamp now. paymentStatus is the caller's responsibility
          // (caller should set PAID_UNVERIFIED when paymentReceiptUrl is set).
          paymentReceiptUrl: data.paymentReceiptUrl ?? null,
          paymentReceiptAt: data.paymentReceiptUrl ? new Date() : null,
          paymentAssumed: data.paymentAssumed ?? false,
          source: data.source ?? "web",
          customerId: data.customerId ?? null,
          ...(data.initialStatus ? { status: data.initialStatus as PrismaOrderStatus } : {}),
        },
      });
      return mapOrder(dbOrder);
    } catch (err: any) {
      lastError = err;
      // Prisma unique constraint error code
      const isUniqueViolation = err?.code === "P2002" || /unique constraint/i.test(err?.message || "");
      if (!isUniqueViolation) throw err;
      // Wait a tiny bit before retrying to spread out concurrent requests
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }

  throw lastError || new Error("createOrder failed after retries");
}

export async function getOrdersByRestaurante(
  restauranteSlug: string,
  todayOnly = true
): Promise<Order[]> {
  const where: any = { restauranteSlug };
  if (todayOnly) {
    const start = getBusinessDayStart();
    const end = getBusinessDayEnd();
    where.createdAt = { gte: start, lt: end };
  }

  const dbOrders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      assignedDriver: {
        select: { id: true, displayName: true, currentLat: true, currentLng: true },
      },
      deliveryOffers: {
        orderBy: { offeredAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          offeredAt: true,
          expiresAt: true,
          distanceKm: true,
        },
      },
    },
  });

  return dbOrders.map(mapOrder);
}

export async function getOrdersByDateRange(
  restauranteSlug: string,
  start: Date,
  end: Date
): Promise<Order[]> {
  const dbOrders = await prisma.order.findMany({
    where: {
      restauranteSlug,
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: "desc" },
  });

  return dbOrders.map(mapOrder);
}

export async function getAllOrders(): Promise<Order[]> {
  const dbOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return dbOrders.map(mapOrder);
}

export async function getOrder(id: string): Promise<Order | null> {
  const dbOrder = await prisma.order.findUnique({ where: { id } });
  return dbOrder ? mapOrder(dbOrder) : null;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  opts?: { markedDeliveredBy?: "driver" | "owner" | "pos" | "print-agent" }
): Promise<Order | null> {
  try {
    const dbOrder = await prisma.order.update({
      where: { id },
      data: {
        status: status as PrismaOrderStatus,
        // Stamp the surface that flipped this to DELIVERED. Only set on the
        // DELIVERED transition itself; other transitions leave it alone.
        ...(status === "DELIVERED" && opts?.markedDeliveredBy
          ? { markedDeliveredBy: opts.markedDeliveredBy }
          : {}),
      },
    });
    return mapOrder(dbOrder);
  } catch {
    return null;
  }
}

export async function markWhatsAppSent(id: string): Promise<Order | null> {
  try {
    const dbOrder = await prisma.order.update({
      where: { id },
      data: { whatsappSent: true },
    });
    return mapOrder(dbOrder);
  } catch {
    return null;
  }
}
