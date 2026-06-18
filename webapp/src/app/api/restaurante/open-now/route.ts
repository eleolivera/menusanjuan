import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";

/**
 * POST /api/restaurante/open-now
 *
 * Owner action: force the restaurant open OUTSIDE of its scheduled hours
 * (e.g. "let's open today even though we normally don't open till 20:30").
 * Mirror of /api/restaurante/close-now. Sets `openUntil` to next-morning 5am AR
 * so:
 *   1. A late-night force-open survives midnight rollover.
 *   2. The next day the override has lapsed and the regular schedule resumes
 *      automatically — owner doesn't need to remember to clear it.
 *
 * `closedUntil` still wins if both are set (close override beats open override).
 *
 * DELETE /api/restaurante/open-now
 *
 * Owner action: cancel the force-open (clears `openUntil`).
 */

function nextMorning5amArMs(): Date {
  // Identical to the helper in close-now/route.ts — kept inline to avoid coupling
  // the two endpoints through a shared util we'd then need to maintain in two
  // places anyway. AR is fixed UTC-3 (no DST), so 5am AR == 08:00 UTC same day.
  const now = new Date();
  const ar = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const arYear = ar.getFullYear();
  const arMonth = ar.getMonth();
  const arDay = ar.getDate();
  const arHour = ar.getHours();
  const targetDay = arHour < 5 ? arDay : arDay + 1;
  return new Date(Date.UTC(arYear, arMonth, targetDay, 8, 0, 0));
}

export async function POST(_request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const openUntil = nextMorning5amArMs();

  // Clear any active closedUntil at the same time — force-open implies the
  // owner wants the resta open RIGHT NOW, so leaving a stale close in place
  // would silently neutralize the override.
  const updated = await prisma.dealer.update({
    where: { id: dealer.id },
    data: { openUntil, closedUntil: null },
    select: { openUntil: true, closedUntil: true },
  });

  return NextResponse.json({
    success: true,
    openUntil: updated.openUntil?.toISOString() || null,
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
    data: { openUntil: null },
  });

  return NextResponse.json({ success: true, openUntil: null });
}
