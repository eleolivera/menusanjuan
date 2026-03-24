import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const success = await loginAdmin(email, password);
  if (!success) {
    return NextResponse.json({ error: "Credenciales incorrectas o no sos admin" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
