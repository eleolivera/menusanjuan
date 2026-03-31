import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/restaurante-auth";

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

// POST — enable placeholder owner (generate credentials, mark verified)
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

  // Generate a readable password
  const plainPassword = generatePassword();
  const hashedPassword = hashPassword(plainPassword);

  // Update the user password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // Mark restaurant as verified/claimed
  await prisma.dealer.update({
    where: { id },
    data: {
      isVerified: true,
      claimedAt: new Date(),
    },
  });

  // Store plain password on onboarding card for admin reference
  await prisma.onboardingCard.upsert({
    where: { dealerId: id },
    update: { lastPassword: plainPassword },
    create: { dealerId: id, lastPassword: plainPassword },
  });

  return NextResponse.json({
    success: true,
    email: user.email,
    password: plainPassword,
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

  // Only allow disabling placeholder accounts
  if (!dealer.account.user.email.endsWith("@menusanjuan.com")) {
    return NextResponse.json({ error: "Solo se pueden desactivar cuentas placeholder" }, { status: 400 });
  }

  await prisma.dealer.update({
    where: { id },
    data: {
      isVerified: false,
      claimedAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
