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

// DELETE — delete user (and their accounts/dealers)
export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });

  // Don't allow deleting admin
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (user.role === "ADMIN") return NextResponse.json({ error: "No se puede eliminar un admin" }, { status: 403 });

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
