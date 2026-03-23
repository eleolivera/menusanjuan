// Prisma-backed order store — persistent in PostgreSQL

import { prisma } from "./prisma";
import { OrderStatus as PrismaOrderStatus } from "@/generated/prisma/client";

export type OrderStatus = "GENERATED" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED";

export type OrderItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

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
  notes: string;
  whatsappSent: boolean;
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

async function nextOrderNumber(restauranteSlug: string): Promise<string> {
  const todayStart = getBusinessDayStart();
  const todayEnd = getBusinessDayEnd();

  const count = await prisma.order.count({
    where: {
      restauranteSlug,
      createdAt: { gte: todayStart, lt: todayEnd },
    },
  });

  const arNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const arHour = arNow.getUTCHours();
  // If before 6am, use previous day's date for the label
  let labelDate = arNow;
  if (arHour < BUSINESS_DAY_END_HOUR) {
    labelDate = new Date(arNow.getTime() - 24 * 60 * 60 * 1000);
  }
  const mm = String(labelDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(labelDate.getUTCDate()).padStart(2, "0");
  const seq = String(count + 1).padStart(3, "0");

  return `ORD-${mm}${dd}-${seq}`;
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
    notes: dbOrder.notes || "",
    whatsappSent: dbOrder.whatsappSent,
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
}): Promise<Order> {
  const orderNumber = await nextOrderNumber(data.restauranteSlug);

  const dbOrder = await prisma.order.create({
    data: {
      orderNumber,
      restauranteSlug: data.restauranteSlug,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      items: data.items as any,
      total: data.total,
      notes: data.notes || null,
    },
  });

  return mapOrder(dbOrder);
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
  status: OrderStatus
): Promise<Order | null> {
  try {
    const dbOrder = await prisma.order.update({
      where: { id },
      data: { status: status as PrismaOrderStatus },
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
