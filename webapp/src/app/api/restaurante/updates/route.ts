import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession } from "@/lib/restaurante-auth";
import { getUnseenUpdates, OWNER_UPDATES } from "@/lib/changelog";

/**
 * GET — returns the list of "Novedades" the owner hasn't acknowledged yet.
 * The OwnerUpdatesModal calls this on mount inside the owner portal layout.
 */
export async function GET(_request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const unseen = getUnseenUpdates(dealer.lastSeenUpdate ?? null);
  return NextResponse.json({ unseen });
}

/**
 * POST — acknowledge an update by id. We store the id on the dealer record so
 * the modal never re-pops for the same entry on the same restaurant.
 * Body: { id: string }
 */
export async function POST(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id: string | undefined = body?.id;
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }
  // Reject ids the server doesn't know about — prevents the client from setting
  // arbitrary strings that would mask future updates.
  if (!OWNER_UPDATES.some((u) => u.id === id)) {
    return NextResponse.json({ error: "Update desconocido" }, { status: 400 });
  }

  await prisma.dealer.update({
    where: { id: dealer.id },
    data: { lastSeenUpdate: id },
  });

  return NextResponse.json({ success: true, lastSeenUpdate: id });
}
