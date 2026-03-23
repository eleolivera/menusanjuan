import { NextResponse } from "next/server";
import { getRestauranteSession, destroyRestauranteSession } from "@/lib/restaurante-auth";

export async function GET() {
  const session = await getRestauranteSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, slug: session.slug });
}

export async function DELETE() {
  await destroyRestauranteSession();
  return NextResponse.json({ success: true });
}
