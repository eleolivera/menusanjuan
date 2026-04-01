import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, createSession } from "@/lib/restaurante-auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { accounts: { where: { type: "dealer" }, include: { dealer: true } } },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Path A: Change password (keep root email)
  if (action === "change-password") {
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(newPassword), mustChangePassword: false },
    });

    return NextResponse.json({ success: true });
  }

  // Path B: Create own account (replace placeholder)
  if (action === "create-account") {
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Completa todos los campos" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    // Check email not taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Este email ya esta registrado. Inicia sesion con ese email." }, { status: 400 });
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashPassword(password),
        name,
        role: "BUSINESS",
        emailVerified: false,
        mustChangePassword: false,
      },
    });

    // Reassign all accounts from placeholder to new user
    await prisma.account.updateMany({
      where: { userId: user.id },
      data: { userId: newUser.id },
    });

    // Delete placeholder user if orphaned
    const remainingAccounts = await prisma.account.count({ where: { userId: user.id } });
    if (remainingAccounts === 0) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }

    // Create session for new user
    const firstDealer = user.accounts[0]?.dealer;
    await createSession(newUser.id, firstDealer?.slug || undefined);

    // Add note to onboarding card
    if (firstDealer) {
      const card = await prisma.onboardingCard.findUnique({ where: { dealerId: firstDealer.id } });
      if (card) {
        await prisma.onboardingNote.create({
          data: { cardId: card.id, text: `Dueno real creado: ${name} (${email})` },
        });
      }
    }

    return NextResponse.json({ success: true, slug: firstDealer?.slug });
  }

  return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
}
