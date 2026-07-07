// Hour × day-of-week grid for the dashboard "Operaciones" tab.
//
// Single SQL uses EXTRACT with AT TIME ZONE 'America/Argentina/Buenos_Aires'
// so the grid always reflects local business hours regardless of the server's
// UTC clock. Returns a 7 × 24 sparse array of {dow, hour, orders, revenue}.
// dow = 0 (Sunday) through 6 (Saturday), hour = 0..23 in AR time.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getDateRange } from "@/lib/orders-store";

type Cell = { dow: number; hour: number; orders: bigint; revenue: number };

export async function GET(request: Request) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "month";
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");
  const range = period === "custom" && customStart && customEnd
    ? { start: new Date(customStart), end: new Date(customEnd) }
    : getDateRange(period);
  const { start, end } = range;

  const rows = await prisma.$queryRaw<Cell[]>`
    SELECT
      EXTRACT(dow FROM o."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::int AS dow,
      EXTRACT(hour FROM o."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::int AS hour,
      COUNT(*)::bigint AS orders,
      SUM(COALESCE(o.total, 0) + COALESCE(o."deliveryFee", 0))::float8 AS revenue
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
      AND o.status = 'DELIVERED'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;

  const grid = rows.map((r) => ({
    dow: r.dow,
    hour: r.hour,
    orders: Number(r.orders),
    revenue: Math.round(Number(r.revenue)),
  }));

  return NextResponse.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    grid, // sparse: cells with zero orders are omitted
  });
}
