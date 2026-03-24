import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — verify email with code
export async function POST(request: NextRequest) {
  const { email, code } = await request.json();
  if (!email || !code) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email ya verificado" }, { status: 400 });

  if (!user.verifyCode || user.verifyCode !== code) {
    return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyCode: null },
  });

  return NextResponse.json({ success: true });
}
