import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/restaurante-auth";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O/0/I/1
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST — enable placeholder owner (generate code, mark verified)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: { account: { include: { user: true } } },
  });
  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const user = dealer.account.user;
  const isPlaceholder = user.email.endsWith("@menusanjuan.com");
  if (!isPlaceholder) {
    return NextResponse.json({ error: "Este restaurante ya tiene un dueño real" }, { status: 400 });
  }

  // If the admin previously typed a real owner email into "Asignar dueño por
  // email" but that user wasn't registered yet, it's sitting in
  // dealer.pendingOwnerEmail. Promote it to the placeholder User now so the
  // generated credentials + WhatsApp message use the owner's real address —
  // not the {slug}@menusanjuan.com placeholder no one will check.
  let finalEmail = user.email;
  if (dealer.pendingOwnerEmail) {
    const promoted = dealer.pendingOwnerEmail.toLowerCase().trim();

    // Guard: someone else may have registered with this email in the meantime.
    const conflict = await prisma.user.findUnique({ where: { email: promoted } });
    if (conflict && conflict.id !== user.id) {
      return NextResponse.json(
        {
          error: `Ya existe una cuenta con ${promoted}. Usá "Asignar dueño por email" para vincular esa cuenta existente en vez de habilitar el placeholder.`,
        },
        { status: 409 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { email: promoted },
    });
    await prisma.dealer.update({
      where: { id },
      data: { pendingOwnerEmail: null },
    });
    finalEmail = promoted;
  }

  const code = generateCode();
  const hashedPassword = hashPassword(code);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, mustChangePassword: true },
  });

  await prisma.dealer.update({
    where: { id },
    data: { isVerified: true, claimedAt: new Date() },
  });

  await prisma.onboardingCard.upsert({
    where: { dealerId: id },
    update: { lastPassword: code },
    create: { dealerId: id, lastPassword: code },
  });

  return NextResponse.json({
    success: true,
    email: finalEmail,
    code,
    slug: dealer.slug,
    name: dealer.name,
  });
}

// DELETE — disable placeholder owner (revert to unverified, remove claim)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: { account: { include: { user: true } } },
  });
  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (!dealer.account.user.email.endsWith("@menusanjuan.com")) {
    return NextResponse.json({ error: "Solo se pueden desactivar cuentas placeholder" }, { status: 400 });
  }

  await prisma.dealer.update({
    where: { id },
    data: { isVerified: false, claimedAt: null },
  });

  return NextResponse.json({ success: true });
}
