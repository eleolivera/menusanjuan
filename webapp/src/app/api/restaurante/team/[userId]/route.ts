// Remove a STAFF member from the active resta. Owner-only.
// Guards:
//   • Reject if targeting yourself (owners can't remove themselves this way —
//     ownership changes happen via admin panel).
//   • Reject if targeting a role='OWNER' row (same reason).
//
// User row is NOT deleted; they may own or be a member of other restas.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteContext } from "@/lib/restaurante-auth";
import { assertOwner, NotOwnerError } from "@/lib/ownership";

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
