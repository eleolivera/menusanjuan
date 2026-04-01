import { NextRequest, NextResponse } from "next/server";
import { loginWithEmail } from "@/lib/restaurante-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Ingresá email y contraseña" }, { status: 400 });
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
