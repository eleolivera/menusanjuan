import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { accounts: true, claimRequests: true } },
    },
  });

  return NextResponse.json(users);
}

// PATCH — update user role
export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId, role } = await request.json();
  if (!userId || !["USER", "BUSINESS", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return NextResponse.json({ success: true, email: updated.email, role: updated.role });
}

// DELETE — delete user, orphan their restaurants (make claimable again)
export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: { include: { dealer: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (user.role === "ADMIN") return NextResponse.json({ error: "No se puede eliminar un admin" }, { status: 403 });

  const { hashPassword } = await import("@/lib/restaurante-auth");

  await prisma.$transaction(async (tx) => {
    // For each restaurant this user owns, create a placeholder user and re-link
    for (const account of user.accounts) {
      if (account.dealer) {
        const slug = account.dealer.slug;
        const placeholderEmail = `${slug}@menusanjuan.com`;

        // Check if placeholder already exists
        let placeholderUser = await tx.user.findUnique({ where: { email: placeholderEmail } });
        if (!placeholderUser) {
          placeholderUser = await tx.user.create({
            data: {
              email: placeholderEmail,
              password: hashPassword("menusj2024"),
              name: account.dealer.name,
              phone: account.dealer.phone,
            },
          });
        }

        // Re-link the account to the placeholder
        await tx.account.update({
          where: { id: account.id },
          data: { userId: placeholderUser.id },
        });

        // Mark restaurant as unclaimed
        await tx.dealer.update({
          where: { id: account.dealer.id },
          data: { isVerified: false, claimedAt: null },
        });
      }
    }

    // Delete claim requests by this user
    await tx.claimRequest.deleteMany({ where: { userId } });

    // Delete sessions
    await tx.session.deleteMany({ where: { userId } });

    // Now safe to delete the user (no more cascading accounts)
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ success: true, orphanedRestaurants: user.accounts.filter(a => a.dealer).length });
}
