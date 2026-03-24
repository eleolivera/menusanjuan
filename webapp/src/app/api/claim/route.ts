import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteSession } from "@/lib/restaurante-auth";
import crypto from "crypto";

const CLAIM_SECRET = process.env.CLAIM_SECRET || "menusj-claim-2024";

// Generate deterministic 6-char code from dealer ID
function generateClaimCode(dealerId: string): string {
  return crypto
    .createHash("sha256")
    .update(dealerId + CLAIM_SECRET)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

// POST — submit a claim request
export async function POST(request: NextRequest) {
  const session = await getRestauranteSession();

  const body = await request.json();
  const { dealerId, userId, action, code, claimId } = body;

  // Action: submit a new claim request (from public page, may or may not be logged in)
  if (action === "submit") {
    if (!dealerId || !userId) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Check if dealer exists and is unclaimed
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: { account: { include: { user: true } } },
    });
    if (!dealer) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

    // Check for existing pending claim
    const existing = await prisma.claimRequest.findFirst({
      where: { dealerId, userId, status: { in: ["PENDING", "CODE_SENT"] } },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya tenés un reclamo pendiente para este restaurante", existing: true }, { status: 409 });
    }

    const claim = await prisma.claimRequest.create({
      data: { dealerId, userId },
    });

    return NextResponse.json({ success: true, claimId: claim.id }, { status: 201 });
  }

  // Action: verify code (user enters the code they received)
  if (action === "verify") {
    if (!claimId || !code) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const claim = await prisma.claimRequest.findUnique({
      where: { id: claimId },
      include: { dealer: { include: { account: true } }, user: true },
    });
    if (!claim) return NextResponse.json({ error: "Reclamo no encontrado" }, { status: 404 });
    if (claim.status === "APPROVED") return NextResponse.json({ error: "Este reclamo ya fue aprobado" }, { status: 400 });
    if (claim.status === "REJECTED") return NextResponse.json({ error: "Este reclamo fue rechazado" }, { status: 400 });

    // Verify the code
    if (!claim.code || claim.code !== code.toUpperCase()) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    // Approve: transfer ownership
    await prisma.$transaction(async (tx) => {
      // Update claim status
      await tx.claimRequest.update({
        where: { id: claimId },
        data: { status: "APPROVED", resolvedAt: new Date() },
      });

      // Transfer the dealer's account to the claiming user
      await tx.user.update({
        where: { id: claim.dealer.account.userId },
        data: {
          email: claim.user.email,
          password: claim.user.password,
          name: claim.user.name,
          phone: claim.user.phone,
          role: "BUSINESS",
        },
      });

      // Mark dealer as claimed and verified
      await tx.dealer.update({
        where: { id: claim.dealerId },
        data: {
          isVerified: true,
          claimedAt: new Date(),
        },
      });

      // Delete the claiming user's original account (they now own the dealer's user)
      // Only if it's a different user
      if (claim.dealer.account.userId !== claim.userId) {
        await tx.user.delete({ where: { id: claim.userId } });
      }
    });

    return NextResponse.json({ success: true, slug: claim.dealer.slug });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}

// GET — check claim status for a user + dealer
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get("dealerId");
  const userId = searchParams.get("userId");

  if (!dealerId) return NextResponse.json({ error: "Falta dealerId" }, { status: 400 });

  const where: any = { dealerId };
  if (userId) where.userId = userId;

  const claims = await prisma.claimRequest.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json(claims);
}
