import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";

// POST — request to claim an unclaimed restaurant.
// This creates a ClaimRequest (status PENDING) — it does NOT transfer ownership.
// The admin verifies the request offline (WhatsApp/call), issues a code via the
// admin panel, and the owner enters the code at /restaurante/esperando-codigo
// via POST /api/claim action=verify, which is where ownership actually moves.
export async function POST(request: NextRequest) {
  // Admins cannot claim restaurants.
  if (await getAdminSession()) {
    return NextResponse.json(
      { error: "Los admins no pueden reclamar restaurantes. Cerrá sesión de admin primero." },
      { status: 403 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Tenés que iniciar sesión primero" }, { status: 401 });
  }

  const body = await request.json();
  const { dealerId } = body;
  if (!dealerId) {
    return NextResponse.json({ error: "Falta dealerId" }, { status: 400 });
  }

  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    include: { account: { include: { user: true } } },
  });
  if (!dealer) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  // Verify it's unclaimed (placeholder email)
  if (!dealer.account.user.email.endsWith("@menusanjuan.com")) {
    return NextResponse.json({ error: "Este restaurante ya tiene dueño" }, { status: 409 });
  }

  // Pre-assigned by admin — not openly claimable
  if (dealer.pendingOwnerEmail) {
    return NextResponse.json(
      { error: "Este restaurante ya fue asignado a un dueño" },
      { status: 409 }
    );
  }

  // Existing pending claim by this user on this dealer?
  const existing = await prisma.claimRequest.findFirst({
    where: { dealerId, userId: session.userId, status: { in: ["PENDING", "CODE_SENT"] } },
  });
  if (existing) {
    return NextResponse.json(
      { success: true, claimId: existing.id, status: existing.status, slug: dealer.slug, name: dealer.name },
      { status: 200 }
    );
  }

  // Any other user already has a live claim on this dealer? Block duplicates.
  const other = await prisma.claimRequest.findFirst({
    where: { dealerId, status: { in: ["PENDING", "CODE_SENT"] } },
  });
  if (other) {
    return NextResponse.json(
      { error: "Otro usuario ya pidio este restaurante. Contactanos para resolverlo." },
      { status: 409 }
    );
  }

  const claim = await prisma.claimRequest.create({
    data: { dealerId, userId: session.userId },
  });

  return NextResponse.json({
    success: true,
    claimId: claim.id,
    status: claim.status,
    slug: dealer.slug,
    name: dealer.name,
  }, { status: 201 });
}
