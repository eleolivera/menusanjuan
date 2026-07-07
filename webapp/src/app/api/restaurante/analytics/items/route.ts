// Item-oriented analytics for the dealer dashboard "Ítems" tab.
//
// One $queryRaw uses jsonb_array_elements(Order.items) to unpack the line
// items in SQL — first time this pattern appears in the codebase, so the
// query becomes the reference for future item-level aggregations.
//
// Owner auth via getRestauranteFromSession(); always scoped to dealer.slug.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getDateRange } from "@/lib/orders-store";

type ItemRow = {
  menu_item_id: string | null;
  name: string;
  qty: bigint;
  revenue: number;
  orders_with_item: bigint;
};

type PairRow = {
  when_buying: string;
  when_buying_id: string | null;
  also_buys: string;
  also_buys_id: string | null;
  both_orders: bigint;
  when_orders: bigint;
};

export async function GET(request: Request) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "week";
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");

  const range = period === "custom" && customStart && customEnd
    ? { start: new Date(customStart), end: new Date(customEnd) }
    : getDateRange(period);
  const { start, end } = range;

  // Aggregate line items over DELIVERED orders in the window. jsonb_array_elements
  // expands each Order.items line into its own row; SUM/COUNT collapse them
  // back per menuItemId (falling back to name when the item was ad-hoc).
  const itemRows = await prisma.$queryRaw<ItemRow[]>`
    SELECT
      item->>'menuItemId' AS menu_item_id,
      COALESCE(item->>'name', '(sin nombre)') AS name,
      SUM(COALESCE((item->>'quantity')::int, 1))::bigint AS qty,
      SUM(COALESCE((item->>'total')::float, 0))::float8 AS revenue,
      COUNT(DISTINCT o.id)::bigint AS orders_with_item
    FROM "Order" o, jsonb_array_elements(o.items) AS item
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
      AND o.status = 'DELIVERED'
    GROUP BY 1, 2
    ORDER BY revenue DESC
  `;

  // Join item ids back to MenuItem for category. Ad-hoc lines (no menuItemId
  // or menuItemId not found) get category='Otros'.
  const menuItemIds = itemRows.map((r) => r.menu_item_id).filter((id): id is string => Boolean(id));
  const menuItems = menuItemIds.length > 0
    ? await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds }, category: { dealerId: dealer.id } },
        select: { id: true, name: true, price: true, category: { select: { id: true, name: true } } },
      })
    : [];
  const itemMeta = new Map(menuItems.map((mi) => [mi.id, mi]));

  const enrichedItems = itemRows.map((r) => {
    const meta = r.menu_item_id ? itemMeta.get(r.menu_item_id) : undefined;
    return {
      menuItemId: r.menu_item_id,
      name: r.name,
      category: meta?.category.name || "Otros",
      qty: Number(r.qty),
      revenue: Math.round(Number(r.revenue)),
      ordersWithItem: Number(r.orders_with_item),
    };
  });

  // Two ranked lists for the UI.
  const topByRevenue = [...enrichedItems].slice(0, 10);
  const topByQuantity = [...enrichedItems]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Category rollup.
  const catAcc: Record<string, { qty: number; revenue: number }> = {};
  for (const it of enrichedItems) {
    if (!catAcc[it.category]) catAcc[it.category] = { qty: 0, revenue: 0 };
    catAcc[it.category].qty += it.qty;
    catAcc[it.category].revenue += it.revenue;
  }
  const totalCatRevenue = Object.values(catAcc).reduce((s, c) => s + c.revenue, 0);
  const categoryRollup = Object.entries(catAcc)
    .map(([category, v]) => ({
      category,
      qty: v.qty,
      revenue: v.revenue,
      share: totalCatRevenue > 0 ? v.revenue / totalCatRevenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Dead SKUs — menu items marked available + not sold-out with zero sales in range.
  const soldItemIds = new Set(itemRows.map((r) => r.menu_item_id).filter(Boolean));
  const allMenuItems = await prisma.menuItem.findMany({
    where: { category: { dealerId: dealer.id }, available: true },
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const deadSkus = allMenuItems
    .filter((mi) => !soldItemIds.has(mi.id))
    .map((mi) => ({
      menuItemId: mi.id,
      name: mi.name,
      category: mi.category.name,
      priceARS: mi.price,
    }));

  // Attach-rate matrix — pairs (A, B) with count of orders containing both,
  // sorted by attach rate = both / orders_with_A. Top 10 pairs with a
  // minimum sample size to avoid statistical noise. Uses the same
  // jsonb_array_elements pattern with a self-join per order.
  const pairRows = await prisma.$queryRaw<PairRow[]>`
    WITH order_items AS (
      SELECT DISTINCT o.id AS order_id, item->>'menuItemId' AS menu_item_id, COALESCE(item->>'name', '(sin nombre)') AS name
      FROM "Order" o, jsonb_array_elements(o.items) AS item
      WHERE o."restauranteSlug" = ${dealer.slug}
        AND o."createdAt" >= ${start}
        AND o."createdAt" < ${end}
        AND o.status = 'DELIVERED'
        AND item->>'menuItemId' IS NOT NULL
    ),
    pairs AS (
      SELECT
        a.name AS when_buying, a.menu_item_id AS when_buying_id,
        b.name AS also_buys, b.menu_item_id AS also_buys_id,
        COUNT(DISTINCT a.order_id) AS both_orders
      FROM order_items a
      JOIN order_items b ON a.order_id = b.order_id AND a.menu_item_id <> b.menu_item_id
      GROUP BY 1, 2, 3, 4
    ),
    when_counts AS (
      SELECT menu_item_id, COUNT(DISTINCT order_id) AS orders
      FROM order_items GROUP BY menu_item_id
    )
    SELECT
      p.when_buying, p.when_buying_id,
      p.also_buys, p.also_buys_id,
      p.both_orders::bigint AS both_orders,
      wc.orders::bigint AS when_orders
    FROM pairs p
    JOIN when_counts wc ON wc.menu_item_id = p.when_buying_id
    WHERE p.both_orders >= 3
    ORDER BY (p.both_orders::float / GREATEST(wc.orders, 1)) DESC
    LIMIT 10
  `;

  const attachPairs = pairRows.map((r) => ({
    whenBuying: r.when_buying,
    whenBuyingId: r.when_buying_id,
    alsoBuys: r.also_buys,
    alsoBuysId: r.also_buys_id,
    bothOrders: Number(r.both_orders),
    whenOrders: Number(r.when_orders),
    rate: Number(r.when_orders) > 0 ? Number(r.both_orders) / Number(r.when_orders) : 0,
  }));

  return NextResponse.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    topByRevenue,
    topByQuantity,
    categoryRollup,
    deadSkus,
    attachPairs,
  });
}
