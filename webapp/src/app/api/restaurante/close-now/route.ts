import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

/**
 * POST /api/restaurante/close-now
 *
 * Owner action: temporarily close the restaurant for the rest of the current
 * session (e.g. ran out of food). Sets `closedUntil` to the next morning at
 * 5am AR — chosen so that:
 *   1. A close triggered late at night survives the midnight rollover (so
 *      hitting "close" at 11:55pm doesn't accidentally reopen at 00:05).
 *   2. By the time the resta's normal opening hours kick in next day
 *      (typically >= 8am), `closedUntil` has already lapsed and the regular
 *      schedule resumes automatically.
 *
 * DELETE /api/restaurante/close-now
 *
 * Owner action: undo the early close (clears `closedUntil`).
 */

function nextMorning5amArMs(): Date {
  // Build a Date that represents "next 5:00 AR time" in absolute UTC. Argentina
  // is UTC-3 year-round (no DST), so 5am AR == 08:00 UTC same day.
  const now = new Date();
  const ar = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const arYear = ar.getFullYear();
  const arMonth = ar.getMonth();
  const arDay = ar.getDate();
  const arHour = ar.getHours();

  // If it's currently before 5am AR (late-night session), target TODAY's 5am AR.
  // Otherwise target TOMORROW's 5am AR. Both ensure we cross any sane closing time.
  const targetDay = arHour < 5 ? arDay : arDay + 1;
  // 5am AR in UTC = 08:00 UTC (Argentina is fixed UTC-3, no DST)
  return new Date(Date.UTC(arYear, arMonth, targetDay, 8, 0, 0));
}

export async function POST(_request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const closedUntil = nextMorning5amArMs();

  const updated = await prisma.dealer.update({
    where: { id: dealer.id },
    data: { closedUntil },
    select: { closedUntil: true },
  });

  return NextResponse.json({
    success: true,
    closedUntil: updated.closedUntil?.toISOString() || null,
  });
}

export async function DELETE(_request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await prisma.dealer.update({
    where: { id: dealer.id },
    data: { closedUntil: null },
  });

  return NextResponse.json({ success: true, closedUntil: null });
}
