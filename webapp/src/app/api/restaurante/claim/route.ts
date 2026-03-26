import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSession, createRestauranteSession } from "@/lib/restaurante-auth";

// POST — claim an unclaimed restaurant
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, dealerId } = body;

  if (!dealerId) {
    return NextResponse.json({ error: "Falta dealerId" }, { status: 400 });
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

  // Check if already logged in
  const session = await getSession();

  if (session) {
    // Logged-in user claiming — reassign the dealer's account to this user
    const oldUserId = dealer.account.userId;

    await prisma.account.update({
      where: { id: dealer.account.id },
      data: { userId: session.userId },
    });

    // Mark as claimed
    await prisma.dealer.update({
      where: { id: dealer.id },
      data: { claimedAt: new Date() },
    });

    // Clean up orphaned placeholder user if they have no other accounts
    const otherAccounts = await prisma.account.count({ where: { userId: oldUserId } });
    if (otherAccounts === 0) {
      await prisma.user.delete({ where: { id: oldUserId } }).catch(() => {});
    }

    // Update session to use this restaurant
    await createRestauranteSession(dealer.slug);

    return NextResponse.json({
      success: true,
      slug: dealer.slug,
      name: dealer.name,
    });
  }

  // Not logged in — need email + password (original flow)
  if (!email?.includes("@") || !password) {
    return NextResponse.json({ error: "Faltan datos (email y contraseña)" }, { status: 400 });
  }

  // Check if email is already taken by another user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.id !== dealer.account.userId) {
    return NextResponse.json({ error: "Este email ya está registrado con otra cuenta" }, { status: 409 });
  }

  // Transfer ownership: update email + password on the placeholder user
  await prisma.user.update({
    where: { id: dealer.account.userId },
    data: {
      email,
      password: hashPassword(password),
      name: dealer.name,
    },
  });

  // Mark as claimed
  await prisma.dealer.update({
    where: { id: dealer.id },
    data: { claimedAt: new Date() },
  });

  // Create session
  await createRestauranteSession(dealer.slug);

  return NextResponse.json({
    success: true,
    slug: dealer.slug,
    name: dealer.name,
  });
}
