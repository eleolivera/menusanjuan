import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, createSession } from "@/lib/restaurante-auth";
import crypto from "crypto";

const CLAIM_SECRET = process.env.CLAIM_SECRET || "menusj-claim-2024";

function generateClaimCode(dealerId: string): string {
  return crypto
    .createHash("sha256")
    .update(dealerId + CLAIM_SECRET)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

// POST — submit or verify a claim
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // Submit a new claim request
  if (action === "submit") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Tenés que iniciar sesión primero" }, { status: 401 });
    }

    const { dealerId } = body;
    if (!dealerId) return NextResponse.json({ error: "Falta dealerId" }, { status: 400 });

    // Check for existing pending claim by this user
    const existing = await prisma.claimRequest.findFirst({
      where: { dealerId, userId: session.userId, status: { in: ["PENDING", "CODE_SENT"] } },
    });
    if (existing) {
      return NextResponse.json({
        error: "Ya tenés un reclamo pendiente para este restaurante",
        claimId: existing.id,
        status: existing.status,
      }, { status: 409 });
    }

    const claim = await prisma.claimRequest.create({
      data: { dealerId, userId: session.userId },
    });

    return NextResponse.json({ success: true, claimId: claim.id }, { status: 201 });
  }

  // Verify code and transfer ownership
  if (action === "verify") {
    const { claimId, code } = body;
    if (!claimId || !code) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const claim = await prisma.claimRequest.findUnique({
      where: { id: claimId },
      include: {
        dealer: { include: { account: true } },
        user: true,
      },
    });
    if (!claim) return NextResponse.json({ error: "Reclamo no encontrado" }, { status: 404 });
    if (claim.status === "APPROVED") return NextResponse.json({ error: "Ya fue aprobado" }, { status: 400 });
    if (claim.status === "REJECTED") return NextResponse.json({ error: "Fue rechazado" }, { status: 400 });

    if (!claim.code || claim.code !== code.toUpperCase()) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    // Transfer ownership: re-link the Account to the claiming user
    const oldUserId = claim.dealer.account.userId;
    const isPlaceholder = (await prisma.user.findUnique({ where: { id: oldUserId } }))
      ?.email.endsWith("@menusanjuan.com");

    await prisma.$transaction(async (tx) => {
      // Approve the claim
      await tx.claimRequest.update({
        where: { id: claimId },
        data: { status: "APPROVED", resolvedAt: new Date() },
      });

      // Link the Account to the claiming user
      await tx.account.update({
        where: { id: claim.dealer.account.id },
        data: { userId: claim.userId },
      });

      // Mark dealer as verified + claimed
      await tx.dealer.update({
        where: { id: claim.dealerId },
        data: { isVerified: true, claimedAt: new Date() },
      });

      // Update claiming user's role to BUSINESS
      await tx.user.update({
        where: { id: claim.userId },
        data: { role: "BUSINESS" },
      });

      // Delete the placeholder user if it has no other accounts
      if (isPlaceholder && oldUserId !== claim.userId) {
        const otherAccounts = await tx.account.count({ where: { userId: oldUserId } });
        if (otherAccounts === 0) {
          await tx.user.delete({ where: { id: oldUserId } });
        }
      }
    });

    // Update session to include this restaurant
    await createSession(claim.userId, claim.dealer.slug);

    return NextResponse.json({ success: true, slug: claim.dealer.slug });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}

// GET — get claims for a dealer or the current user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get("dealerId");
  const mine = searchParams.get("mine");

  if (mine === "true") {
    const session = await getSession();
    if (!session) return NextResponse.json([], { status: 200 });

    const claims = await prisma.claimRequest.findMany({
      where: { userId: session.userId },
      orderBy: { requestedAt: "desc" },
      include: { dealer: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json(claims);
  }

  if (dealerId) {
    const session = await getSession();
    const claims = await prisma.claimRequest.findMany({
      where: {
        dealerId,
        ...(session ? { userId: session.userId } : {}),
      },
      orderBy: { requestedAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    });
    return NextResponse.json(claims);
  }

  return NextResponse.json([]);
}
