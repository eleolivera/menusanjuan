// POST /api/network/driver/offers/[offerId]/reject
//
// Driver explicitly declines. Only mutates the ONE offer row; no cascade — the
// P3 dispatcher is responsible for re-offering to the next candidate. This
// endpoint stays a pure ledger write so P2 stays isolated from dispatch logic.
//
// Guards:
//   - offer must exist         → 404 offer_not_found
//   - offer must belong to me
//     and be PENDING           → 409 not_pending
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

  // Distinguish 404 (bad URL) from 409 (offer not mine / already resolved).
  const existing = await prisma.deliveryOffer.findUnique({
    where: { id: offerId },
    select: { id: true },
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

  return NextResponse.json({ ok: true });
}
