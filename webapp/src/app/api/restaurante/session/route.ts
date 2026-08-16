import { NextRequest, NextResponse } from "next/server";
import { getFullSession, switchActiveRestaurant, destroyRestauranteSession } from "@/lib/restaurante-auth";

export async function GET() {
  try {
    // getFullSession now returns either a real owner session OR an
    // admin-impersonation synth-session (when both admin + admin_as cookies
    // are valid). If it returns null, either no owner cookie exists or an
    // admin cookie is present without impersonation — either way, 401.
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
      // True when admin is currently viewing this resta via impersonation.
      // Consumed by DashboardShell to render the "Salir del modo admin" banner.
      impersonatedByAdmin: session.impersonatedByAdmin,
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
      deliveryMode: (session.activeRestaurant as { deliveryMode?: string })?.deliveryMode ?? null,
      // Role of the acting user on the currently active resta. UI hides
      // owner-only controls (Equipo section, financial fields) when STAFF.
      // Server enforces regardless via assertOwner() on the routes.
      role: (session.activeRestaurant as { role?: "OWNER" | "STAFF" })?.role ?? null,
      email: session.user.email,
      mustChangePassword: session.user.mustChangePassword,
    });
  } catch (err: any) {
    console.error("Session error:", err.message);
    return NextResponse.json({ authenticated: false, error: "DB temporarily unavailable" }, { status: 503 });
  }
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
