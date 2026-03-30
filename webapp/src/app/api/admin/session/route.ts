import { NextResponse } from "next/server";
import { getAdminSession, destroyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Try to get user email, but don't fail if DB is unavailable
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true },
    });
    return NextResponse.json({
      authenticated: true,
      email: user?.email || "admin",
      name: user?.name || "Admin",
    });
  } catch {
    // DB unavailable — still return authenticated (cookie is valid)
    return NextResponse.json({
      authenticated: true,
      email: "admin",
      name: "Admin",
    });
  }
}

export async function DELETE() {
  await destroyAdminSession();
  return NextResponse.json({ success: true });
}
