// Cron: expire stale PENDING DeliveryOffers and cascade-dispatch to next-nearest candidate.
// Scheduled every minute via /vercel.json.
// Auth: Vercel auto-injects `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// present as a Production env var. Reject anything else with 401.
//
// Semantics:
//   1. Find every DeliveryOffer with status=PENDING and expiresAt<now.
//   2. For each, `updateMany` to EXPIRED (guarded by status=PENDING so we lose gracefully
//      if the driver accepted/rejected in the interim — updateMany.count===0 skips it).
//   3. For each *distinct* orderId whose offer we successfully expired, sequentially
//      await dispatchOrder(orderId). Sequential (not Promise.all) prevents two sibling
//      cascades from double-offering the same order in the same run.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchOrder } from "@/lib/dispatch";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const stale = await prisma.deliveryOffer.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, orderId: true },
  });

  const dispatchedOrderIds = new Set<string>();
  const results: Array<{ orderId: string; dispatchResult: unknown }> = [];
  let expired = 0;

  for (const o of stale) {
    const flip = await prisma.deliveryOffer.updateMany({
      where: { id: o.id, status: "PENDING" },
      data: { status: "EXPIRED", respondedAt: now },
    });
    if (flip.count !== 1) continue; // lost race — driver accepted/rejected between findMany and here
    expired++;
    if (dispatchedOrderIds.has(o.orderId)) continue; // one cascade per order per run
    dispatchedOrderIds.add(o.orderId);
    try {
      const r = await dispatchOrder(o.orderId);
      results.push({ orderId: o.orderId, dispatchResult: r });
    } catch (err) {
      results.push({
        orderId: o.orderId,
        dispatchResult: { ok: false, reason: "threw", err: String(err) },
      });
    }
  }

  return NextResponse.json({ expired, dispatched: dispatchedOrderIds.size, results });
}
