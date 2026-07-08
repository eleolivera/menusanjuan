// POST/DELETE /api/network/driver/push/subscribe
//
// Manages a driver's Web Push subscriptions (rows in DriverPushSubscription).
//
// Auth: uses getDriverSession (NOT requireDriverSession — that redirects, which
// would break the fetch coming from PushRegistrar / the service worker; we want
// an explicit 401 JSON body so the caller can react).
//
// POST body : { endpoint, keys: { p256dh, auth }, userAgent? }
// DELETE body: { endpoint }
//
// POST is an upsert keyed on `endpoint` (which is @unique on the model). If the
// same endpoint gets re-subscribed by a different driver on the same device,
// ownership transfers to the new driver — endpoints are per-browser-install, so
// there's no legitimate case where two drivers share one.
//
// DELETE uses `deleteMany` (idempotent) scoped to the current driver so one
// driver can't yank another's subscription by guessing an endpoint.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

export async function POST(req: Request) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = body as {
    endpoint?: unknown;
    keys?: unknown;
    userAgent?: unknown;
  };

  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!keys || typeof keys !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (
    typeof p256dh !== "string" ||
    p256dh.length === 0 ||
    typeof auth !== "string" ||
    auth.length === 0
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const ua =
    typeof userAgent === "string" && userAgent.length > 0 ? userAgent : null;

  await prisma.driverPushSubscription.upsert({
    where: { endpoint },
    create: {
      driverId: session.driverId,
      endpoint,
      p256dh,
      auth,
      userAgent: ua,
    },
    update: {
      driverId: session.driverId,
      p256dh,
      auth,
      userAgent: ua,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { endpoint } = body as { endpoint?: unknown };
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await prisma.driverPushSubscription.deleteMany({
    where: { endpoint, driverId: session.driverId },
  });

  return NextResponse.json({ ok: true });
}
