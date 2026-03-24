import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const ADMIN_KEY = process.env.ADMIN_KEY || "admin-menusj-2024";
const CLAIM_SECRET = process.env.CLAIM_SECRET || "menusj-claim-2024";

function checkAdmin(request: NextRequest): boolean {
  const key = request.headers.get("x-admin-key");
  return key === ADMIN_KEY;
}

function generateClaimCode(dealerId: string): string {
  return crypto
    .createHash("sha256")
    .update(dealerId + CLAIM_SECRET)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

// GET — list all claim requests
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const claims = await prisma.claimRequest.findMany({
    orderBy: { requestedAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
      dealer: { select: { id: true, name: true, slug: true, phone: true } },
    },
  });

  return NextResponse.json(claims);
}

// PATCH — update claim (generate code, approve, reject)
export async function PATCH(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { claimId, action, notes } = body;

  if (!claimId) return NextResponse.json({ error: "Falta claimId" }, { status: 400 });

  const claim = await prisma.claimRequest.findUnique({
    where: { id: claimId },
    include: { dealer: true },
  });
  if (!claim) return NextResponse.json({ error: "Reclamo no encontrado" }, { status: 404 });

  if (action === "generate_code") {
    const code = generateClaimCode(claim.dealerId);
    const updated = await prisma.claimRequest.update({
      where: { id: claimId },
      data: { code, status: "CODE_SENT", notes },
    });
    return NextResponse.json({ ...updated, code });
  }

  if (action === "reject") {
    const updated = await prisma.claimRequest.update({
      where: { id: claimId },
      data: { status: "REJECTED", resolvedAt: new Date(), notes },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
