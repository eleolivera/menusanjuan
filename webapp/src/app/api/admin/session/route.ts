import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, name: true },
  });

  return NextResponse.json({
    authenticated: true,
    email: user?.email,
    name: user?.name,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("menusj_admin");
  return NextResponse.json({ success: true });
}
