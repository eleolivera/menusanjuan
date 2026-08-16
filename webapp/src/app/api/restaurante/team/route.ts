// /restaurante/team — owner-only endpoints for the Equipo section on
// /restaurante/profile. Owner adds employee by email; the endpoint upserts a
// User row keyed on that email (empty password → OAuth-only) and inserts a
// STAFF DealerMember(dealerId, userId, role='STAFF'). When the employee later
// signs in with Google using the same email, the OAuth callback adopts the
// pre-created User row (see /api/auth/google/callback) and the session-layer
// union surfaces the dealer in her switcher.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteContext } from "@/lib/restaurante-auth";
import { assertOwner, NotOwnerError } from "@/lib/ownership";

// GET — list current members (both roles) for the active resta.
export async function GET() {
  const ctx = await getRestauranteContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // GET is owner-only — the list itself is admin-only info; staff don't
  // need to see other members. Simpler than a mixed-role read model.
  try { assertOwner(ctx.role); }
  catch (err) {
    if (err instanceof NotOwnerError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const members = await prisma.dealerMember.findMany({
    where: { dealerId: ctx.dealer.id },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      isPlaceholder: m.user.email.endsWith("@menusanjuan.com"),
      notifyNewOrders: m.notifyNewOrders,
    })),
  );
}

// POST { email } — add a STAFF member. Silent invite: no email/WhatsApp sent
// from here — Matias tells his employee verbally to sign in with Google.
export async function POST(request: NextRequest) {
  const ctx = await getRestauranteContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { assertOwner(ctx.role); }
  catch (err) {
    if (err instanceof NotOwnerError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  let email: string;
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!email.includes("@") || email.length < 5) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  if (email.endsWith("@menusanjuan.com")) {
    return NextResponse.json({ error: "No podés agregar emails del sistema" }, { status: 400 });
  }
  // Don't let the owner add their own email as staff — it's confusing and
  // would violate the "one OWNER at a time" invariant if they were later
  // demoted. If they want to re-invite themselves as staff, that's a no-op.
  if (email === ctx.dealer.account.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Ya sos el dueño de este restaurante" }, { status: 400 });
  }

  // Look up or create the User for this email. Password="" marks the row as
  // OAuth-only; the Google callback adopts by email (see
  // /api/auth/google/callback/route.ts line ~120). If the User already exists
  // (with a real password from a prior signup), we still add them as STAFF —
  // they can log in with either credential and see this resta.
  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          password: "", // OAuth-only until they sign in with Google
          name: email.split("@")[0],
          role: "BUSINESS",
        },
      });
    }

    // Reject if already a DealerMember of this resta (OWNER or STAFF).
    const existing = await tx.dealerMember.findUnique({
      where: { dealerId_userId: { dealerId: ctx.dealer.id, userId: user.id } },
    });
    if (existing) {
      return { conflict: true as const, existingRole: existing.role, user };
    }

    const member = await tx.dealerMember.create({
      data: {
        dealerId: ctx.dealer.id,
        userId: user.id,
        role: "STAFF",
        addedByUserId: ctx.sessionUserId,
      },
    });
    return { conflict: false as const, user, member };
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: `${email} ya es ${result.existingRole === "OWNER" ? "el dueño" : "miembro"} de este restaurante` },
      { status: 409 },
    );
  }

  return NextResponse.json({
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    role: "STAFF",
    createdAt: result.member.createdAt.toISOString(),
    isPlaceholder: false,
    notifyNewOrders: result.member.notifyNewOrders,
  }, { status: 201 });
}
