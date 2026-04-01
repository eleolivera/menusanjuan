import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/restaurante-auth";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST — reset access code for any restaurant owner
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const dealer = await prisma.dealer.findUnique({
    where: { id },
    include: { account: { include: { user: true } } },
  });
  if (!dealer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const code = generateCode();

  await prisma.user.update({
    where: { id: dealer.account.user.id },
    data: { password: hashPassword(code), mustChangePassword: true },
  });

  await prisma.onboardingCard.upsert({
    where: { dealerId: id },
    update: { lastPassword: code },
    create: { dealerId: id, lastPassword: code },
  });

  return NextResponse.json({
    success: true,
    code,
    email: dealer.account.user.email,
  });
}
