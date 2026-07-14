// Core P3 dispatch. Given an Order id, picks the nearest eligible on-shift
// driver from the appropriate pool(s) per Dealer.deliveryMode and creates a
// PENDING DeliveryOffer with a 30s TTL. Never throws under normal operation;
// every branch returns a DispatchResult.
//
// Notes:
//  - Does NOT write Order.assignedDriverId (that happens only on ACCEPT or via
//    the manual override endpoints).
//  - Race-safe: offer creation happens inside a $transaction that re-verifies
//    no live PENDING offer exists for the orderId.
//  - Blacklist: any driver with a prior REJECTED/EXPIRED/CANCELLED offer for
//    this order — plus any driver holding an expired-but-still-PENDING offer —
//    is excluded from subsequent attempts.

import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/delivery";
import { sendPushToDriver } from "@/lib/push";

export type DispatchReason =
  | "order_not_found"
  | "order_delivered"
  | "already_assigned"
  | "not_delivery"
  | "manual_mode"
  | "no_dealer_coords"
  | "no_available_drivers";

export type DispatchResult =
  | { ok: true; offerId: string; driverId: string; poolUsed: "OWN" | "NETWORK"; debug?: Record<string, unknown> }
  | { ok: false; reason: DispatchReason; debug?: Record<string, unknown> };

// 45s: gives real drivers time to react to a push notification (animation + finger travel).
const OFFER_TTL_MS = 45_000;
const HEARTBEAT_WINDOW_MS = 90_000;

export async function dispatchOrder(orderId: string): Promise<DispatchResult> {
  // 1. Load order.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      restauranteSlug: true,
      status: true,
      assignedDriverId: true,
      deliveryMethod: true,
      deliveryFee: true,
    },
  });
  if (!order) return { ok: false, reason: "order_not_found" };

  // 2-4. Order-level gates.
  if (order.status === "DELIVERED") return { ok: false, reason: "order_delivered" };
  if (order.assignedDriverId != null) return { ok: false, reason: "already_assigned" };
  if (order.deliveryMethod !== "delivery") return { ok: false, reason: "not_delivery" };

  // 5. Load dealer.
  const dealer = await prisma.dealer.findUnique({
    where: { slug: order.restauranteSlug },
    select: { id: true, name: true, latitude: true, longitude: true, deliveryMode: true },
  });
  if (!dealer) return { ok: false, reason: "no_dealer_coords" };

  // 6-7. Dealer-level gates.
  if (dealer.deliveryMode === "MANUAL") return { ok: false, reason: "manual_mode" };
  if (dealer.latitude == null || dealer.longitude == null) {
    return { ok: false, reason: "no_dealer_coords" };
  }

  // 8. Blacklist + in-flight PENDING check.
  const prior = await prisma.deliveryOffer.findMany({
    where: {
      orderId,
      status: { in: ["REJECTED", "EXPIRED", "CANCELLED", "PENDING"] },
    },
    select: { driverId: true, status: true, expiresAt: true },
  });
  const blacklist = new Set<string>();
  const now = new Date();
  for (const p of prior) {
    if (p.status === "PENDING") {
      if (p.expiresAt > now) return { ok: false, reason: "already_assigned" };
      // expired-but-still-PENDING → blacklist and keep going
      blacklist.add(p.driverId);
    } else {
      blacklist.add(p.driverId);
    }
  }

  // 9. Pool order by mode.
  const pools: Array<"OWN" | "NETWORK"> =
    dealer.deliveryMode === "OWN"
      ? ["OWN"]
      : dealer.deliveryMode === "NETWORK"
        ? ["NETWORK"]
        : ["OWN", "NETWORK"]; // HYBRID

  const heartbeatFloor = new Date(Date.now() - HEARTBEAT_WINDOW_MS);

  // Pre-fetch drivers with in-flight assignments (any non-DELIVERED assigned
  // Order). Prisma's `assignedOrders: { none: ... }` filter proved unreliable
  // in prod (returned zero candidates even when raw SQL showed matches), so we
  // resolve the "busy driver" set explicitly and merge into the blacklist.
  const busy = await prisma.order.findMany({
    where: { assignedDriverId: { not: null }, status: { not: "DELIVERED" } },
    select: { assignedDriverId: true },
  });
  for (const b of busy) if (b.assignedDriverId) blacklist.add(b.assignedDriverId);
  const blacklistArr = Array.from(blacklist);

  const debug: Record<string, unknown> = {
    dealerId: dealer.id,
    deliveryMode: dealer.deliveryMode,
    pools,
    heartbeatFloor: heartbeatFloor.toISOString(),
    blacklistSize: blacklistArr.length,
    perPoolCandidateCount: {} as Record<string, number>,
  };

  // 10-11. Try each pool in order.
  for (const pool of pools) {
    const where: Record<string, unknown> = {
      isActive: true,
      // Skip drivers who haven't been approved yet.
      pendingApproval: false,
      onShift: true,
      lastPingAt: { gte: heartbeatFloor },
      ownerDealerId: pool === "OWN" ? dealer.id : null,
      currentLat: { not: null },
      currentLng: { not: null },
    };
    // Only pass notIn when non-empty — Prisma 7 has an edge case where
    // `{ notIn: [] }` can behave unexpectedly.
    if (blacklistArr.length > 0) where.id = { notIn: blacklistArr };

    const candidates = await prisma.driver.findMany({
      where,
      select: { id: true, currentLat: true, currentLng: true },
    });

    (debug.perPoolCandidateCount as Record<string, number>)[pool] = candidates.length;
    console.info("[dispatch]", { orderId, pool, ...debug });

    if (candidates.length === 0) continue;

    // Rank by distance to dealer, ascending.
    const ranked = candidates
      .map((d) => ({
        id: d.id,
        distanceKm: haversineDistance(
          d.currentLat!,
          d.currentLng!,
          dealer.latitude!,
          dealer.longitude!,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const chosen = ranked[0];

    // Race-guarded offer creation. If someone else created a PENDING offer
    // for this order between step 8 and now, abort.
    const offer = await prisma.$transaction(async (tx) => {
      const inflight = await tx.deliveryOffer.findFirst({
        where: {
          orderId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (inflight) return null;
      return tx.deliveryOffer.create({
        data: {
          orderId,
          driverId: chosen.id,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + OFFER_TTL_MS),
          status: "PENDING",
          distanceKm: chosen.distanceKm,
        },
        select: { id: true, driverId: true },
      });
    });

    if (offer === null) return { ok: false, reason: "already_assigned", debug };

    // P4 — fire-and-forget web push. Never blocks or fails dispatch; offer is
    // already committed, push is best-effort (poll is the fallback channel).
    const expiresAtIso = new Date(Date.now() + OFFER_TTL_MS).toISOString();
    sendPushToDriver(offer.driverId, {
      type: "offer",
      offerId: offer.id,
      orderId,
      restauranteName: dealer.name,
      deliveryFee: order.deliveryFee ?? 0,
      distanceKm: chosen.distanceKm,
      expiresAt: expiresAtIso,
    }).catch((err) => console.warn("[dispatch] push send failed:", err));

    return { ok: true, offerId: offer.id, driverId: offer.driverId, poolUsed: pool, debug };
  }

  // 12. All pools exhausted with zero candidates.
  return { ok: false, reason: "no_available_drivers", debug };
}
