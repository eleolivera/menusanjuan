import { NextRequest, NextResponse } from "next/server";
import { loginWithEmail } from "@/lib/restaurante-auth";
import { getAdminSession, destroyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // If an admin cookie is present, nuke it up front — same call the Salir
    // button in /admin uses. This guarantees the admin session is really
    // gone before we set the business session, regardless of cookie path
    // quirks on any particular browser.
    if (await getAdminSession()) {
      await destroyAdminSession();
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
