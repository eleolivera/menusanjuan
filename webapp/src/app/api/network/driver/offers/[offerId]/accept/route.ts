// POST /api/network/driver/offers/[offerId]/accept
//
// Race-safe offer acceptance. Wrapped in a $transaction so a concurrent accept
// by a sibling driver (or an expiry sweeper flipping the row to CANCELLED)
// can't produce a double-assigned Order.
//
// Guards:
//   - offer must exist         → 404 offer_not_found
//   - offer must belong to me  → 409 already_taken (don't leak other drivers' offer ids)
//   - offer must be PENDING    → 409 already_taken
//   - offer must be unexpired  → 409 already_taken
//   - Order.assignedDriverId must be null at flip time → 409 already_taken
//
// On success: flip THIS offer to ACCEPTED, stamp Order.assignedDriverId, and
// CANCEL every sibling PENDING offer on the same order (dispatch cascade is
// out of scope — that's P3).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { offerId } = await params;

  // Pre-check for 404 outside the tx so we can distinguish "typo'd URL" from
  // "someone else already took it". Cheap read; inside the tx we re-check
  // everything anyway.
  const existing = await prisma.deliveryOffer.findUnique({
    where: { id: offerId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Re-read under tx to guarantee PENDING+unexpired+mine.
      const offer = await tx.deliveryOffer.findFirst({
        where: {
          id: offerId,
          driverId: session.driverId,
          status: "PENDING",
          expiresAt: { gt: now },
        },
        select: { id: true, orderId: true },
      });
      if (!offer) {
        throw new Error("ALREADY_TAKEN");
      }

      // Flip THIS offer to ACCEPTED.
      await tx.deliveryOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED", respondedAt: now },
      });

      // Compound updateMany: only assigns if the order still has no driver.
      // If someone else won the race, count===0 and we roll back the tx.
      const assigned = await tx.order.updateMany({
        where: { id: offer.orderId, assignedDriverId: null },
        data: { assignedDriverId: session.driverId },
      });
      if (assigned.count === 0) {
        throw new Error("ALREADY_TAKEN");
      }

      // Cancel every sibling PENDING offer on the same order.
      await tx.deliveryOffer.updateMany({
        where: {
          orderId: offer.orderId,
          status: "PENDING",
          id: { not: offer.id },
        },
        data: { status: "CANCELLED", respondedAt: now },
      });

      return { orderId: offer.orderId };
    });

    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_TAKEN") {
      return NextResponse.json({ error: "already_taken" }, { status: 409 });
    }
    throw err;
  }
}
