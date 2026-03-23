import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createRestauranteSession } from "@/lib/restaurante-auth";

// POST — claim an unclaimed restaurant
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, dealerId } = body;

  if (!email?.includes("@") || !password || !dealerId) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // Find the dealer
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

  // Check if email is already taken by another user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.id !== dealer.account.userId) {
    return NextResponse.json({ error: "Este email ya está registrado con otra cuenta" }, { status: 409 });
  }

  // Transfer ownership: update email + password on the existing user
  await prisma.user.update({
    where: { id: dealer.account.userId },
    data: {
      email,
      password: hashPassword(password),
      name: dealer.name,
    },
  });

  // Create session
  await createRestauranteSession(dealer.slug);

  return NextResponse.json({
    success: true,
    slug: dealer.slug,
    name: dealer.name,
  }, { status: 200 });
}
