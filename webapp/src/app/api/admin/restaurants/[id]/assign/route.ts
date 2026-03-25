import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// POST — assign owner to restaurant by email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: dealerId } = await params;
  const { email } = await request.json();

  if (!email?.includes("@")) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    include: { account: true },
  });
  if (!dealer) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // User exists — re-link the account to this user
    await prisma.account.update({
      where: { id: dealer.account.id },
      data: { userId: user.id },
    });

    // Update user role
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "BUSINESS" },
    });

    // Mark as verified + claimed
    await prisma.dealer.update({
      where: { id: dealerId },
      data: { isVerified: true, claimedAt: new Date() },
    });

    // Clean up old placeholder user if orphaned
    const oldUserId = dealer.account.userId;
    if (oldUserId !== user.id) {
      const otherAccounts = await prisma.account.count({ where: { userId: oldUserId } });
      if (otherAccounts === 0) {
        const oldUser = await prisma.user.findUnique({ where: { id: oldUserId } });
        if (oldUser?.email.endsWith("@menusanjuan.com")) {
          await prisma.user.delete({ where: { id: oldUserId } });
        }
      }
    }

    return NextResponse.json({ success: true, linked: true, email });
  } else {
    // User doesn't exist yet — save email for auto-link when they register
    await prisma.dealer.update({
      where: { id: dealerId },
      data: { pendingOwnerEmail: email },
    });

    return NextResponse.json({
      success: true,
      linked: false,
      pending: true,
      message: `Guardado. Cuando ${email} se registre, el restaurante se le asignará automáticamente.`,
    });
  }
}

// DELETE — remove owner (revert to placeholder)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id: dealerId } = await params;

  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    include: { account: { include: { user: true } } },
  });
  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Already a placeholder
  if (dealer.account.user.email.endsWith("@menusanjuan.com")) {
    return NextResponse.json({ error: "Ya no tiene dueño" }, { status: 400 });
  }

  // Create a new placeholder user + account, re-link the dealer
  const { hashPassword } = await import("@/lib/restaurante-auth");
  const placeholderEmail = `${dealer.slug}@menusanjuan.com`;

  // Check if placeholder email already exists
  const existingPlaceholder = await prisma.user.findUnique({ where: { email: placeholderEmail } });

  if (existingPlaceholder) {
    await prisma.account.update({
      where: { id: dealer.account.id },
      data: { userId: existingPlaceholder.id },
    });
  } else {
    const newUser = await prisma.user.create({
      data: {
        email: placeholderEmail,
        password: hashPassword("menusj2024"),
        name: dealer.name,
        phone: dealer.phone,
      },
    });
    await prisma.account.update({
      where: { id: dealer.account.id },
      data: { userId: newUser.id },
    });
  }

  await prisma.dealer.update({
    where: { id: dealerId },
    data: { isVerified: false, claimedAt: null },
  });

  return NextResponse.json({ success: true });
}
