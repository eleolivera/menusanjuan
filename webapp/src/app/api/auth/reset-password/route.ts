import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/restaurante-auth";
import { sendEmail, resetPasswordEmailHtml } from "@/lib/email";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // Request a reset code
  if (action === "request") {
    const { email } = body;
    if (!email) return NextResponse.json({ error: "Falta email" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return NextResponse.json({ success: true });
    }

    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetCode: code, resetExpires: expires },
    });

    await sendEmail({
      to: email,
      subject: "Restablecer contraseña — MenuSanJuan",
      html: resetPasswordEmailHtml(user.name, code),
    });

    const isDev = !process.env.MAILERSEND_API_KEY;
    return NextResponse.json({ success: true, ...(isDev && { code }) });
  }

  // Reset password with code
  if (action === "reset") {
    const { email, code, newPassword } = body;
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Mínimo 6 caracteres" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetCode || user.resetCode !== code) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }
    if (user.resetExpires && user.resetExpires < new Date()) {
      return NextResponse.json({ error: "Código expirado. Solicitá uno nuevo." }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashPassword(newPassword),
        resetCode: null,
        resetExpires: null,
      },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
