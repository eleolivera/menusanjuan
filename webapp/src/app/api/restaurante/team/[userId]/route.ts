// Per-member operations on the active resta:
//   PATCH  — owner toggles notifyNewOrders for any member (including self)
//   DELETE — owner removes a STAFF member
// Guards on DELETE:
//   • Reject if targeting yourself (owners can't remove themselves this way —
//     ownership changes happen via admin panel).
//   • Reject if targeting a role='OWNER' row (same reason).
// User row is NOT deleted; they may own or be a member of other restas.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteContext } from "@/lib/restaurante-auth";
import { assertOwner, NotOwnerError } from "@/lib/ownership";

// PATCH { notifyNewOrders: boolean } — toggle whether this member receives
// "nuevo pedido" emails. Owner-only. Applies to owner's own row too so they
// can silence themselves without demoting.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const ctx = await getRestauranteContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { assertOwner(ctx.role); }
  catch (err) {
    if (err instanceof NotOwnerError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  let body: { notifyNewOrders?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  if (typeof body.notifyNewOrders !== "boolean") {
    return NextResponse.json({ error: "notifyNewOrders (boolean) es requerido" }, { status: 400 });
  }

  const member = await prisma.dealerMember.findUnique({
    where: { dealerId_userId: { dealerId: ctx.dealer.id, userId } },
  });
  if (!member) {
    return NextResponse.json({ error: "Ese usuario no es miembro" }, { status: 404 });
  }

  const updated = await prisma.dealerMember.update({
    where: { dealerId_userId: { dealerId: ctx.dealer.id, userId } },
    data: { notifyNewOrders: body.notifyNewOrders },
  });

  return NextResponse.json({ userId, notifyNewOrders: updated.notifyNewOrders });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const ctx = await getRestauranteContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { assertOwner(ctx.role); }
  catch (err) {
    if (err instanceof NotOwnerError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  if (userId === ctx.sessionUserId) {
    return NextResponse.json({ error: "No podés quitarte a vos mismo" }, { status: 400 });
  }

  const member = await prisma.dealerMember.findUnique({
    where: { dealerId_userId: { dealerId: ctx.dealer.id, userId } },
  });
  if (!member) {
    return NextResponse.json({ error: "Ese usuario no es miembro" }, { status: 404 });
  }
  if (member.role === "OWNER") {
    return NextResponse.json(
      { error: "No podés remover al dueño desde acá. Cambiá el dueño desde el panel admin." },
      { status: 400 },
    );
  }

  await prisma.dealerMember.delete({
    where: { dealerId_userId: { dealerId: ctx.dealer.id, userId } },
  });

  return NextResponse.json({ success: true });
}
