import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin-auth";
import { destroyRestauranteSession } from "@/lib/restaurante-auth";
import { authLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = authLimiter(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Esperá un momento." },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Nuke any business session up front — symmetric to restaurante/login.
    await destroyRestauranteSession();

    const success = await loginAdmin(email, password);
    if (!success) {
      return NextResponse.json({ error: "Credenciales incorrectas o no sos admin" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin login error:", err.message);
    return NextResponse.json({ error: "Error del servidor. Intentá de nuevo." }, { status: 500 });
  }
}
