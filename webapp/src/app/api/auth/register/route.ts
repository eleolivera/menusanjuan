import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";

// POST — create a user account (no restaurant). Auto-links pending restaurants.
export async function POST(request: NextRequest) {
  // Admins cannot create a user account from this path.
  if (await getAdminSession()) {
    return NextResponse.json(
      { error: "Cerrá sesión de admin primero." },
      { status: 403 }
    );
  }

  const { email, password, name } = await request.json();

  if (!email?.includes("@") || !password || password.length < 6) {
    return NextResponse.json({ error: "Email y contraseña (mín. 6 caracteres) son obligatorios" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado. Iniciá sesión." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashPassword(password),
        name: name || email.split("@")[0],
      },
    });

    // Check for pending restaurant assignments
    const pendingRestaurants = await tx.dealer.findMany({
      where: { pendingOwnerEmail: email },
      include: { account: true },
    });

    let linkedSlug: string | null = null;

    for (const pending of pendingRestaurants) {
      await tx.account.update({
        where: { id: pending.account.id },
        data: { userId: user.id },
      });
      await tx.dealer.update({
        where: { id: pending.id },
        data: { pendingOwnerEmail: null, isVerified: true, claimedAt: new Date() },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { role: "BUSINESS" },
      });
      if (!linkedSlug) linkedSlug = pending.slug;

      // Clean up placeholder
      const oldCount = await tx.account.count({ where: { userId: pending.account.userId } });
      if (oldCount === 0) {
        const old = await tx.user.findUnique({ where: { id: pending.account.userId } });
        if (old?.email.endsWith("@menusanjuan.com")) {
          await tx.user.delete({ where: { id: pending.account.userId } });
        }
      }
    }

    return { user, linkedSlug, linkedCount: pendingRestaurants.length };
  });

  await createSession(result.user.id, result.linkedSlug || undefined);

  return NextResponse.json({
    success: true,
    userId: result.user.id,
    linkedRestaurants: result.linkedCount,
    slug: result.linkedSlug,
  }, { status: 201 });
}
