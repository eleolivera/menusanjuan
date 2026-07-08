// POST /api/network/driver/ping
// Records the driver's current GPS position while a shift is open. Two guards:
//   - 409 no_active_shift when driver.onShift is false (dispatch only cares
//     about locations of drivers who are actually working).
//   - Server-side 5s throttle keyed on Driver.lastPingAt to protect the DB
//     when a client's watchPosition fires faster than expected. Throttled
//     hits still return 200 so the client's timer keeps running, but with
//     { throttled: true } and no write.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriverSession } from "@/lib/driver-auth";

const THROTTLE_MS = 5_000;

export async function POST(req: Request) {
  const session = await getDriverSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { lat, lng, accuracy } = body as { lat?: unknown; lng?: unknown; accuracy?: unknown };
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (accuracy !== undefined && (typeof accuracy !== "number" || !Number.isFinite(accuracy))) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: { onShift: true, lastPingAt: true },
  });
  if (!driver) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!driver.onShift) return NextResponse.json({ error: "no_active_shift" }, { status: 409 });

  if (driver.lastPingAt && Date.now() - driver.lastPingAt.getTime() < THROTTLE_MS) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  await prisma.driver.update({
    where: { id: session.driverId },
    data: { currentLat: lat, currentLng: lng, lastPingAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
