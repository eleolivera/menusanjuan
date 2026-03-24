import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmailHtml } from "@/lib/email";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST — send verification code to email
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Falta email" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email ya verificado" }, { status: 400 });

  const code = generateCode();
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyCode: code },
  });

  await sendEmail({
    to: email,
    subject: "Tu código de verificación — MenuSanJuan",
    html: verificationEmailHtml(user.name, code),
  });

  // In dev, return the code for testing
  const isDev = !process.env.RESEND_API_KEY;
  return NextResponse.json({
    success: true,
    ...(isDev && { code }),
  });
}
