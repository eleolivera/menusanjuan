// Fulfillment analytics for the dealer "Operaciones" tab.
//
// Turns audit fields already on Order (deliveredAt, paymentReceiptUrl,
// paymentAssumed, markedDeliveredBy, channel) into operational insight:
//   - Time-to-DELIVERED percentiles (avg / p50 / p90 minutes)
//   - Cancel rate per channel
//   - Receipt attach rate (non-cash orders with a comprobante uploaded)
//   - paymentAssumed share (auto-marked-paid on the delivery flip)
//   - markedDeliveredBy split (driver / owner / pos / print-agent)
//
// Owner-auth via getRestauranteFromSession.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getDateRange } from "@/lib/orders-store";

type PctileRow = { avg_mins: number | null; p50_mins: number | null; p90_mins: number | null; sample: bigint };
type ChannelStatusRow = { channel: string; total: bigint; cancelled: bigint };
type CountRow = { key: string | null; count: bigint };

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

  // Time-to-DELIVERED percentiles. Ignores orders without deliveredAt (never
  // marked or legacy rows). Uses percentile_cont for continuous interpolation.
  const [pct] = await prisma.$queryRaw<PctileRow[]>`
    SELECT
      AVG(EXTRACT(EPOCH FROM (o."deliveredAt" - o."createdAt")) / 60)::float8 AS avg_mins,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (o."deliveredAt" - o."createdAt")) / 60)::float8 AS p50_mins,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (o."deliveredAt" - o."createdAt")) / 60)::float8 AS p90_mins,
      COUNT(*)::bigint AS sample
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
      AND o.status = 'DELIVERED'
      AND o."deliveredAt" IS NOT NULL
  `;

  // Cancel rate per channel. All orders (any status) in the window.
  const channelRows = await prisma.$queryRaw<ChannelStatusRow[]>`
    SELECT
      COALESCE(o.channel, 'ONLINE') AS channel,
      COUNT(*)::bigint AS total,
      SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END)::bigint AS cancelled
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
    GROUP BY 1
    ORDER BY total DESC
  `;
  const cancelByChannel = channelRows.map((r) => ({
    channel: r.channel,
    total: Number(r.total),
    cancelled: Number(r.cancelled),
    rate: Number(r.total) > 0 ? Number(r.cancelled) / Number(r.total) : 0,
  }));

  // Receipt attach rate — non-cash payments (paymentIntent transfer or
  // mercadopago) with a paymentReceiptUrl set / total non-cash payments.
  const [receipts] = await prisma.$queryRaw<{ non_cash: bigint; with_receipt: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE o."paymentIntent" IN ('transfer','mercadopago'))::bigint AS non_cash,
      COUNT(*) FILTER (WHERE o."paymentIntent" IN ('transfer','mercadopago') AND o."paymentReceiptUrl" IS NOT NULL)::bigint AS with_receipt
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
  `;
  const receiptAttach = {
    nonCash: Number(receipts.non_cash),
    withReceipt: Number(receipts.with_receipt),
    rate: Number(receipts.non_cash) > 0 ? Number(receipts.with_receipt) / Number(receipts.non_cash) : 0,
  };

  // paymentAssumed share — orders where the cashier auto-flipped to PAID via
  // the '¿estaba pagado?' confirm-through dialog rather than verifying.
  const [assumed] = await prisma.$queryRaw<{ delivered: bigint; assumed: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE o.status = 'DELIVERED')::bigint AS delivered,
      COUNT(*) FILTER (WHERE o.status = 'DELIVERED' AND o."paymentAssumed" = true)::bigint AS assumed
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
  `;
  const paymentAssumed = {
    delivered: Number(assumed.delivered),
    assumed: Number(assumed.assumed),
    rate: Number(assumed.delivered) > 0 ? Number(assumed.assumed) / Number(assumed.delivered) : 0,
  };

  // markedDeliveredBy — which surface actually closes the orders.
  const markedRows = await prisma.$queryRaw<CountRow[]>`
    SELECT
      COALESCE(o."markedDeliveredBy", 'unknown') AS key,
      COUNT(*)::bigint AS count
    FROM "Order" o
    WHERE o."restauranteSlug" = ${dealer.slug}
      AND o."createdAt" >= ${start}
      AND o."createdAt" < ${end}
      AND o.status = 'DELIVERED'
    GROUP BY 1
    ORDER BY count DESC
  `;
  const markedDeliveredBy = markedRows.map((r) => ({
    surface: r.key || "unknown",
    count: Number(r.count),
  }));

  return NextResponse.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    timing: {
      avgMinsToDelivered: pct.avg_mins != null ? Math.round(Number(pct.avg_mins)) : null,
      p50MinsToDelivered: pct.p50_mins != null ? Math.round(Number(pct.p50_mins)) : null,
      p90MinsToDelivered: pct.p90_mins != null ? Math.round(Number(pct.p90_mins)) : null,
      sample: Number(pct.sample),
    },
    cancelByChannel,
    receiptAttach,
    paymentAssumed,
    markedDeliveredBy,
  });
}
