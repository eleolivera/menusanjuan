// POST /api/network/driver/offers/[offerId]/reject
//
// Driver explicitly declines. Flips the ONE offer row to REJECTED, then
// P3 cascade active: after ledger write, we synchronously dispatch to the
// next-nearest candidate. Cascade is best-effort and never blocks the driver
// response on failure.
//
// Guards:
//   - offer must exist         → 404 offer_not_found
//   - offer must belong to me
//     and be PENDING           → 409 not_pending
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";
import { dispatchOrder } from "@/lib/dispatch";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { offerId } = await params;

  // Distinguish 404 (bad URL) from 409 (offer not mine / already resolved).
  // Grab orderId now so we can cascade after the successful REJECT flip.
  const existing = await prisma.deliveryOffer.findUnique({
    where: { id: offerId },
    select: { id: true, orderId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
  }

  const updated = await prisma.deliveryOffer.updateMany({
    where: {
      id: offerId,
      driverId: session.driverId,
      status: "PENDING",
    },
    data: { status: "REJECTED", respondedAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "not_pending" }, { status: 409 });
  }

  // P3 cascade — only after the flip actually succeeded (count === 1).
  // Best-effort: never rethrow; caller (driver) already got their reject
  // acknowledged the moment the ledger write returned.
  try {
    const cascade = await dispatchOrder(existing.orderId);
    if (cascade.ok) {
      console.info("reject cascade dispatched", { orderId: existing.orderId, ...cascade });
    } else {
      console.warn("reject cascade skipped", { orderId: existing.orderId, reason: cascade.reason });
    }
  } catch (err) {
    console.error("reject cascade threw:", err);
  }

  return NextResponse.json({ ok: true });
}
