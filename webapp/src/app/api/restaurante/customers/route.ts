// Owner-side customer CRM aggregation.
//
// GET returns one row per customer who has ordered from THIS dealer. Rows
// include lifetime totals, last-order gap, and current rewards progress. Used
// by /restaurante/clientes.
//
// Anonymous / legacy orders (no customerId) are excluded — they can't be
// contacted anyway. Owner sees only their own dealer's customers.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

export type CustomerRow = {
  customerId: string;
  phone: string;
  displayName: string | null;
  lastCustomerName: string | null;
  totalOrders: number;
  deliveredOrders: number;
  ltv: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  daysSinceLastOrder: number | null;
  punches: number;
  redemptionsTotal: number;
  redemptionsReady: number;
  hasGoogleSignIn: boolean;
  giftsReady: number;
};

export type CustomersResponse = {
  program: {
    id: string;
    name: string;
    punchesNeeded: number;
    rewardItemName: string;
    enabled: boolean;
    qualifyingCount: number | null;
  } | null;
  totals: {
    uniqueCustomers: number;
    recurring: number;
    ordersTotal: number;
    ltvTotal: number;
    avgOrdersPerCustomer: number;
    medianDaysSinceLastOrder: number | null;
    rewardsEnrolled: number;      // customers with any punches
    rewardsHalfway: number;        // customers ≥50% of punchesNeeded
    rewardsEligible: number;       // customers ≥ punchesNeeded
    redemptionsTotal: number;      // total redemptions all-time
  };
  customers: CustomerRow[];
};

export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Aggregate orders per customer for this dealer. One SQL pass.
  const orderAgg = await prisma.$queryRaw<Array<{
    customerId: string;
    total_orders: bigint;
    delivered_orders: bigint;
    ltv: number | null;
    last_order_at: Date | null;
    first_order_at: Date | null;
    last_customer_name: string | null;
  }>>`
    SELECT
      o."customerId" AS "customerId",
      COUNT(*)::bigint AS total_orders,
      COUNT(*) FILTER (WHERE o."status" = 'DELIVERED')::bigint AS delivered_orders,
      COALESCE(SUM(CASE WHEN o."status" = 'DELIVERED' THEN (o."total" + o."deliveryFee") ELSE 0 END), 0)::float8 AS ltv,
      MAX(o."createdAt") AS last_order_at,
      MIN(o."createdAt") AS first_order_at,
      (SELECT o2."customerName"
         FROM "Order" o2
        WHERE o2."customerId" = o."customerId" AND o2."restauranteSlug" = ${dealer.slug}
        ORDER BY o2."createdAt" DESC
        LIMIT 1) AS last_customer_name
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."customerId" IS NOT NULL
    GROUP BY o."customerId"
  `;

  if (orderAgg.length === 0) {
    return NextResponse.json({
      program: null,
      totals: emptyTotals(),
      customers: [],
    } satisfies CustomersResponse);
  }

  const customerIds = orderAgg.map((r) => r.customerId);

  // Customer identity rows for phone + name + Google-link status.
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, phone: true, displayName: true, googleSub: true },
  });
  const customerById = new Map(customers.map((c) => [c.id, c]));

  // Rewards program for this dealer (may be null).
  const program = await prisma.rewardProgram.findUnique({
    where: { dealerId: dealer.id },
    select: {
      id: true,
      name: true,
      punchesNeeded: true,
      enabled: true,
      qualifyingItemIds: true,
      rewardItem: { select: { name: true } },
    },
  });

  // Punches per customer for the dealer's program.
  const progressMap = new Map<string, number>();
  if (program) {
    const progress = await prisma.rewardProgress.findMany({
      where: { programId: program.id, customerId: { in: customerIds } },
      select: { customerId: true, punches: true },
    });
    for (const p of progress) progressMap.set(p.customerId, p.punches);
  }

  // Redemption counts per customer for this program.
  type RedemptionAgg = { customerId: string; total: bigint; ready: bigint };
  const redemptionRows: RedemptionAgg[] = program
    ? await prisma.$queryRaw<RedemptionAgg[]>`
        SELECT r."customerId" AS "customerId",
               COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE r."status" = 'READY')::bigint AS ready
          FROM "Redemption" r
         WHERE r."programId" = ${program.id}
           AND r."customerId" = ANY(${customerIds}::text[])
         GROUP BY r."customerId"
      `
    : [];
  const redemptionMap = new Map<string, { total: number; ready: number }>(
    redemptionRows.map((r) => [r.customerId, { total: Number(r.total), ready: Number(r.ready) }])
  );

  // Gift redemptions (kind starts with 'GIFT_'): counted separately so the
  // owner sees which customers have unclaimed gifts pending.
  type GiftAgg = { customerId: string; ready: bigint };
  const giftRows: GiftAgg[] = await prisma.$queryRaw<GiftAgg[]>`
    SELECT r."customerId" AS "customerId",
           COUNT(*) FILTER (WHERE r."status" = 'READY')::bigint AS ready
      FROM "Redemption" r
     WHERE r."customerId" = ANY(${customerIds}::text[])
       AND r."kind" LIKE 'GIFT_%'
     GROUP BY r."customerId"
  `;
  const giftMap = new Map<string, number>(giftRows.map((r) => [r.customerId, Number(r.ready)]));

  const now = Date.now();
  const rows: CustomerRow[] = orderAgg.map((r) => {
    const c = customerById.get(r.customerId);
    const lastAt = r.last_order_at ? r.last_order_at.getTime() : null;
    const days = lastAt != null ? Math.floor((now - lastAt) / 86_400_000) : null;
    const red = redemptionMap.get(r.customerId);
    return {
      customerId: r.customerId,
      phone: c?.phone || "",
      displayName: c?.displayName || null,
      lastCustomerName: r.last_customer_name,
      totalOrders: Number(r.total_orders),
      deliveredOrders: Number(r.delivered_orders),
      ltv: Number(r.ltv || 0),
      lastOrderAt: r.last_order_at ? r.last_order_at.toISOString() : null,
      firstOrderAt: r.first_order_at ? r.first_order_at.toISOString() : null,
      daysSinceLastOrder: days,
      punches: progressMap.get(r.customerId) || 0,
      redemptionsTotal: red?.total || 0,
      redemptionsReady: red?.ready || 0,
      hasGoogleSignIn: Boolean(c?.googleSub),
      giftsReady: giftMap.get(r.customerId) || 0,
    };
  });

  // Analytics header
  const uniqueCustomers = rows.length;
  const recurring = rows.filter((r) => r.totalOrders >= 2).length;
  const ordersTotal = rows.reduce((s, r) => s + r.totalOrders, 0);
  const ltvTotal = rows.reduce((s, r) => s + r.ltv, 0);
  const avgOrdersPerCustomer = uniqueCustomers === 0 ? 0 : ordersTotal / uniqueCustomers;
  const days = rows.map((r) => r.daysSinceLastOrder).filter((d): d is number => d != null).sort((a, b) => a - b);
  const medianDaysSinceLastOrder =
    days.length === 0
      ? null
      : days.length % 2 === 1
        ? days[(days.length - 1) / 2]
        : Math.round((days[days.length / 2 - 1] + days[days.length / 2]) / 2);
  const needed = program?.punchesNeeded || Infinity;
  const rewardsEnrolled = rows.filter((r) => r.punches > 0).length;
  const rewardsHalfway = rows.filter((r) => r.punches >= needed / 2).length;
  const rewardsEligible = rows.filter((r) => r.punches >= needed).length;
  const redemptionsTotal = rows.reduce((s, r) => s + r.redemptionsTotal, 0);

  const qualifyingCount = Array.isArray(program?.qualifyingItemIds)
    ? (program!.qualifyingItemIds as unknown[]).length
    : null;

  return NextResponse.json({
    program: program
      ? {
          id: program.id,
          name: program.name,
          punchesNeeded: program.punchesNeeded,
          rewardItemName: program.rewardItem.name,
          enabled: program.enabled,
          qualifyingCount,
        }
      : null,
    totals: {
      uniqueCustomers,
      recurring,
      ordersTotal,
      ltvTotal,
      avgOrdersPerCustomer,
      medianDaysSinceLastOrder,
      rewardsEnrolled,
      rewardsHalfway,
      rewardsEligible,
      redemptionsTotal,
    },
    customers: rows,
  } satisfies CustomersResponse);
}

function emptyTotals(): CustomersResponse["totals"] {
  return {
    uniqueCustomers: 0,
    recurring: 0,
    ordersTotal: 0,
    ltvTotal: 0,
    avgOrdersPerCustomer: 0,
    medianDaysSinceLastOrder: null,
    rewardsEnrolled: 0,
    rewardsHalfway: 0,
    rewardsEligible: 0,
    redemptionsTotal: 0,
  };
}
