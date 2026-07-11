// Admin-only: fire a test web push to a specific driver, bypassing dispatch.
// Used to isolate the push infrastructure (VAPID keys, service worker,
// subscription upsert, sendPushToDriver → webpush.sendNotification chain)
// from all the dispatch eligibility filters. If this works but real dispatch
// doesn't, the problem is in dispatch. If this doesn't work, the problem is
// in push.
//
// POST /api/admin/test-push { driverId?: string, driverPhone?: string }
// GET  /api/admin/test-push?driverPhone=+549...  (URL-clickable convenience
//   for debug pushes from browser tabs; the endpoint is admin-gated + purely
//   internal so hitting it via GET is fine).
// Auth: getAdminSession — 401 otherwise.
//
// The payload uses a synthetic offerId so tapping Aceptar/Rechazar on the
// notification will 404 — that's fine. This test is only for confirming the
// push physically arrives on the device.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { sendPushToDriver } from "@/lib/push";

async function fireTestPush(driverIdArg: string | undefined, driverPhoneArg: string | undefined) {
  let driverId = driverIdArg?.trim();
  if (!driverId && driverPhoneArg) {
    const driver = await prisma.driver.findUnique({
      where: { phone: driverPhoneArg.trim() },
      select: { id: true },
    });
    if (!driver) return { status: 404, body: { error: "driver_not_found" } };
    driverId = driver.id;
  }
  if (!driverId) return { status: 400, body: { error: "missing_driverId_or_phone" } };

  const subCount = await prisma.driverPushSubscription.count({ where: { driverId } });
  if (subCount === 0) {
    return {
      status: 400,
      body: {
        error: "no_push_subscriptions",
        hint: "driver hasn't granted notification permission yet",
      },
    };
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
  return { status: 200, body: { ok: true, driverId, subscriptions: subCount, ...result } };
}

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
  const { status, body: resBody } = await fireTestPush(body.driverId, body.driverPhone);
  return NextResponse.json(resBody, { status });
}

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const { status, body: resBody } = await fireTestPush(
    searchParams.get("driverId") ?? undefined,
    searchParams.get("driverPhone") ?? undefined,
  );
  return NextResponse.json(resBody, { status });
}
