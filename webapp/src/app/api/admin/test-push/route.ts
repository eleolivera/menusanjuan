// Admin-only: fire a test web push to a specific driver, bypassing dispatch.
// Used to isolate the push infrastructure (VAPID keys, service worker,
// subscription upsert, sendPushToDriver → webpush.sendNotification chain)
// from all the dispatch eligibility filters. If this works but real dispatch
// doesn't, the problem is in dispatch. If this doesn't work, the problem is
// in push.
//
// POST /api/admin/test-push { driverId?: string, driverPhone?: string }
// Auth: getAdminSession — 401 otherwise.
//
// The payload uses a synthetic offerId so tapping Aceptar/Rechazar on the
// notification will 404 — that's fine. This test is only for confirming the
// push physically arrives on the device.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { sendPushToDriver } from "@/lib/push";

export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { driverId?: string; driverPhone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let driverId = body.driverId?.trim();
  if (!driverId && body.driverPhone) {
    const driver = await prisma.driver.findUnique({
      where: { phone: body.driverPhone.trim() },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ error: "driver_not_found" }, { status: 404 });
    }
    driverId = driver.id;
  }
  if (!driverId) {
    return NextResponse.json({ error: "missing_driverId_or_phone" }, { status: 400 });
  }

  const subCount = await prisma.driverPushSubscription.count({ where: { driverId } });
  if (subCount === 0) {
    return NextResponse.json(
      { error: "no_push_subscriptions", hint: "driver hasn't granted notification permission yet" },
      { status: 400 },
    );
  }

  const result = await sendPushToDriver(driverId, {
    type: "offer",
    offerId: `test-${Date.now()}`,
    orderId: `test-order`,
    restauranteName: "Prueba MenuSanJuan",
    deliveryFee: 1500,
    distanceKm: 1.2,
    expiresAt: new Date(Date.now() + 45_000).toISOString(),
  });

  return NextResponse.json({ ok: true, driverId, subscriptions: subCount, ...result });
}
