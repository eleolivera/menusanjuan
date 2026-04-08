import { NextRequest, NextResponse } from "next/server";
import { loginWithEmail } from "@/lib/restaurante-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Admins cannot log in as a restaurant owner — they already have the admin
    // panel. This prevents the "admin types in an owner email and takes over"
    // confusion.
    if (await getAdminSession()) {
      return NextResponse.json(
        { error: "Cerrá sesión de admin primero para operar como dueño." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Ingresá email y contraseña" }, { status: 400 });
    }

    // If the target user is an admin, refuse — admins don't own restaurants.
    const targetUser = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (targetUser?.role === "ADMIN") {
      return NextResponse.json(
        { error: "Los admins no tienen panel de dueño. Ingresa desde /admin." },
        { status: 403 }
      );
    }

    const result = await loginWithEmail(email, password);

    if (!result) {
      return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    return NextResponse.json({ success: true, slug: result.slug, mustChangePassword: result.mustChangePassword });
  } catch (err: any) {
    console.error("Login error:", err.message);
    return NextResponse.json({ error: "Error del servidor. Intentá de nuevo." }, { status: 500 });
  }
}
