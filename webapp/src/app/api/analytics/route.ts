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

  // Total delivered revenue now includes deliveryFee, matching the LTV
  // convention in /api/restaurante/customers/route.ts (SUM(total + deliveryFee)
  // WHERE status='DELIVERED'). totalRevenueFood is the food-only subtotal
  // for owners who want to separate food revenue from delivery fee revenue.
  const totalRevenueFood = delivered.reduce((s, o) => s + o.total, 0);
  const deliveryFeeRevenue = delivered.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const totalRevenue = totalRevenueFood + deliveryFeeRevenue;
  const pendingRevenue = active.filter((o) => o.status !== "DELIVERED").reduce((s, o) => s + o.total, 0);
  const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0;

  // Breakdowns over DELIVERED orders — revenue + count per dimension. Owners
  // use these to understand where the money is actually coming from.
  const groupCount = <K extends string>(arr: Order[], key: (o: Order) => K | null | undefined) => {
    const acc: Record<string, { count: number; revenue: number }> = {};
    for (const o of arr) {
      const k = key(o);
      if (!k) continue;
      if (!acc[k]) acc[k] = { count: 0, revenue: 0 };
      acc[k].count++;
      acc[k].revenue += (o.total || 0) + (o.deliveryFee || 0);
    }
    return acc;
  };
  const channelBreakdown = groupCount(delivered, (o) => (o.channel || "ONLINE") as string);
  const paymentMethodBreakdown = groupCount(delivered, (o) => (o.paymentMethod || "unknown") as string);
  const deliveryMethodBreakdown = groupCount(delivered, (o) => (o.deliveryMethod || "delivery") as string);

  // paymentIntent (what customer said at checkout) × paymentMethod (what was
  // actually recorded). Surfaces mismatches — e.g. intent=transfer but
  // method=cash means the cashier ended up taking cash instead. Only orders
  // where both fields are set are counted.
  const paymentIntentVsActual: Record<string, Record<string, number>> = {};
  for (const o of delivered) {
    const intent = o.paymentIntent || "none";
    const method = o.paymentMethod || "unknown";
    if (!paymentIntentVsActual[intent]) paymentIntentVsActual[intent] = {};
    paymentIntentVsActual[intent][method] = (paymentIntentVsActual[intent][method] || 0) + 1;
  }

  // Item aggregation. BY_WEIGHT lines are bucketed separately so their
  // fractional quantities (0.5 kg) don't get summed with integer unit counts
  // — the client can render two blocks (top items vs top-by-weight).
  const itemMap: Record<string, { name: string; quantity: number; revenue: number; isWeight: boolean; unit?: string }> = {};
  for (const order of active) {
    for (const item of order.items) {
      const isWeight = (item as any).pricingMode === "BY_WEIGHT";
      const key = isWeight ? `${item.name}::${(item as any).weightUnit ?? "kg"}` : item.name;
      const quantityIncrement = isWeight ? ((item as any).weight ?? item.quantity) : item.quantity;
      if (itemMap[key]) {
        itemMap[key].quantity += quantityIncrement;
        itemMap[key].revenue += item.total;
      } else {
        itemMap[key] = {
          name: item.name,
          quantity: quantityIncrement,
          revenue: item.total,
          isWeight,
          unit: isWeight ? (item as any).weightUnit ?? "kg" : undefined,
        };
      }
    }
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);

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
      totalRevenueFood,       // food only (excludes deliveryFee)
      deliveryFeeRevenue,     // delivery fee income only
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
    channelBreakdown,
    paymentMethodBreakdown,
    deliveryMethodBreakdown,
    paymentIntentVsActual,
  });
}
