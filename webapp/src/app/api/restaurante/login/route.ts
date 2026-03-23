import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createRestauranteSession } from "@/lib/restaurante-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, password } = body;

  if (!slug || !password) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  await createRestauranteSession(slug);
  return NextResponse.json({ success: true, slug });
}
