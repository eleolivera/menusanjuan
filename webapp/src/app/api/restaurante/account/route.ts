import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestauranteFromSession, hashPassword, verifyPassword } from "@/lib/restaurante-auth";

// PATCH — update email or password
export async function PATCH(request: NextRequest) {
  const dealer = await getRestauranteFromSession();
  if (!dealer) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = dealer.account.userId;
  const body = await request.json();
  const { action } = body;

  // Change email
  if (action === "change_email") {
    const { newEmail } = body;
    if (!newEmail?.includes("@")) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    // Check if email is taken by another user
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: "Este email ya está en uso" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    });

    return NextResponse.json({ success: true, email: newEmail });
  }

  // Change password
  if (action === "change_password") {
    const { currentPassword, newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Allow skipping current password check for placeholder accounts
    const isPlaceholder = user.email.endsWith("@menusanjuan.com");
    if (!isPlaceholder && currentPassword) {
      if (!verifyPassword(currentPassword, user.password)) {
        return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 401 });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
