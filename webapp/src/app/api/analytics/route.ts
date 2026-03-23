import { NextRequest, NextResponse } from "next/server";
import { getOrdersByDateRange, getDateRange } from "@/lib/orders-store";
import type { Order, OrderItem } from "@/lib/orders-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurante = searchParams.get("restaurante");
  const period = searchParams.get("period") || "today";
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");

  if (!restaurante) {
    return NextResponse.json({ error: "Falta restaurante" }, { status: 400 });
  }

  let start: Date;
  let end: Date;

  if (period === "custom" && customStart && customEnd) {
    start = new Date(customStart);
    end = new Date(customEnd);
  } else {
    const range = getDateRange(period);
    start = range.start;
    end = range.end;
  }

  const orders = await getOrdersByDateRange(restaurante, start, end);

  // Compute analytics
  const delivered = orders.filter((o) => o.status === "DELIVERED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");
  const active = orders.filter((o) => !["CANCELLED"].includes(o.status));

  const totalRevenue = delivered.reduce((s, o) => s + o.total, 0);
  const pendingRevenue = active.filter((o) => o.status !== "DELIVERED").reduce((s, o) => s + o.total, 0);
  const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0;

  // Item aggregation
  const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  for (const order of active) {
    for (const item of order.items) {
      if (itemMap[item.name]) {
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].revenue += item.total;
      } else {
        itemMap[item.name] = { name: item.name, quantity: item.quantity, revenue: item.total };
      }
    }
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

  // Orders by hour (AR time)
  const hourlyMap: Record<number, { count: number; revenue: number }> = {};
  for (let h = 0; h < 24; h++) hourlyMap[h] = { count: 0, revenue: 0 };
  for (const order of active) {
    const orderDate = new Date(order.createdAt);
    const arHour = (orderDate.getUTCHours() - 3 + 24) % 24;
    hourlyMap[arHour].count++;
    hourlyMap[arHour].revenue += order.total;
  }

  // Orders by day
  const dailyMap: Record<string, { date: string; label: string; count: number; revenue: number; delivered: number; cancelled: number }> = {};
  for (const order of orders) {
    const d = new Date(order.createdAt);
    const arDate = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const arHour = arDate.getUTCHours();
    // If before 6am, count as previous day
    if (arHour < 6) arDate.setUTCDate(arDate.getUTCDate() - 1);
    const key = arDate.toISOString().split("T")[0];

    if (!dailyMap[key]) {
      dailyMap[key] = {
        date: key,
        label: arDate.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }),
        count: 0,
        revenue: 0,
        delivered: 0,
        cancelled: 0,
      };
    }
    dailyMap[key].count++;
    if (order.status === "DELIVERED") {
      dailyMap[key].revenue += order.total;
      dailyMap[key].delivered++;
    }
    if (order.status === "CANCELLED") dailyMap[key].cancelled++;
  }
  const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Status breakdown
  const statusBreakdown = {
    generated: orders.filter((o) => o.status === "GENERATED").length,
    paid: orders.filter((o) => o.status === "PAID").length,
    processing: orders.filter((o) => o.status === "PROCESSING").length,
    delivered: delivered.length,
    cancelled: cancelled.length,
  };

  // Peak hour
  const peakHour = Object.entries(hourlyMap).reduce(
    (best, [h, data]) => (data.count > best.count ? { hour: Number(h), count: data.count } : best),
    { hour: 0, count: 0 }
  );

  return NextResponse.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    summary: {
      totalOrders: orders.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      totalRevenue,
      pendingRevenue,
      avgOrderValue: Math.round(avgOrderValue),
      peakHour: `${String(peakHour.hour).padStart(2, "0")}:00`,
      peakHourOrders: peakHour.count,
    },
    statusBreakdown,
    topItems,
    hourlyBreakdown: Object.entries(hourlyMap)
      .map(([h, data]) => ({ hour: Number(h), label: `${String(h).padStart(2, "0")}:00`, ...data }))
      .filter((h) => h.count > 0),
    dailyBreakdown,
  });
}
