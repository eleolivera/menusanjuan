import { NextRequest, NextResponse } from "next/server";
import { getFullSession, switchActiveRestaurant, destroyRestauranteSession } from "@/lib/restaurante-auth";

export async function GET() {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    restaurants: session.restaurants,
    activeRestaurant: session.activeRestaurant,
    pendingClaims: session.pendingClaims,
    // Backward compat fields
    userId: session.user.id,
    dealerId: session.activeRestaurant?.id,
    slug: session.activeRestaurant?.slug,
    name: session.activeRestaurant?.name,
    phone: session.activeRestaurant?.phone,
    address: session.activeRestaurant?.address,
    cuisineType: session.activeRestaurant?.cuisineType,
    description: session.activeRestaurant?.description,
    logoUrl: session.activeRestaurant?.logoUrl,
    coverUrl: session.activeRestaurant?.coverUrl,
    email: session.user.email,
  });
}

// PATCH — switch active restaurant
export async function PATCH(request: NextRequest) {
  const { slug } = await request.json();
  if (!slug) return NextResponse.json({ error: "Falta slug" }, { status: 400 });

  await switchActiveRestaurant(slug);
  return NextResponse.json({ success: true, activeSlug: slug });
}

export async function DELETE() {
  await destroyRestauranteSession();
  return NextResponse.json({ success: true });
}
