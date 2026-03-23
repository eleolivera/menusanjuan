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

// Get start of today in AR timezone (UTC-3)
function getTodayStart(): Date {
  const now = new Date();
  // Argentina is UTC-3
  const arTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dateStr = arTime.toISOString().split("T")[0]; // YYYY-MM-DD in AR time
  // Convert back: midnight AR time = 03:00 UTC
  return new Date(`${dateStr}T03:00:00.000Z`);
}

// Generate daily order number: ORD-MMDD-001
async function nextOrderNumber(restauranteSlug: string): Promise<string> {
  const todayStart = getTodayStart();

  const count = await prisma.order.count({
    where: {
      restauranteSlug,
      createdAt: { gte: todayStart },
    },
  });

  const now = new Date();
  const arTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const mm = String(arTime.getMonth() + 1).padStart(2, "0");
  const dd = String(arTime.getDate()).padStart(2, "0");
  const seq = String(count + 1).padStart(3, "0");

  return `ORD-${mm}${dd}-${seq}`;
}

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

// Get today's orders for a restaurant
export async function getOrdersByRestaurante(
  restauranteSlug: string,
  todayOnly = true
): Promise<Order[]> {
  const where: any = { restauranteSlug };
  if (todayOnly) {
    where.createdAt = { gte: getTodayStart() };
  }

  const dbOrders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return dbOrders.map(mapOrder);
}

// Get all orders (admin)
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
