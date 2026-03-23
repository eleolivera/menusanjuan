import { NextResponse } from "next/server";
import { getRestauranteSession, getRestauranteFromSession, destroyRestauranteSession } from "@/lib/restaurante-auth";

export async function GET() {
  const dealer = await getRestauranteFromSession();
  if (!dealer) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    slug: dealer.slug,
    name: dealer.name,
    phone: dealer.phone,
    address: dealer.address,
    cuisineType: dealer.cuisineType,
    description: dealer.description,
    logoUrl: dealer.logoUrl,
    coverUrl: dealer.coverUrl,
    email: dealer.account.user.email,
  });
}

export async function DELETE() {
  await destroyRestauranteSession();
  return NextResponse.json({ success: true });
}
