import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { cookieDomain } from "@/lib/cookie-domain";

// GET /api/auth/google — redirect to Google OAuth consent screen
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth no configurado" }, { status: 500 });
  }

  const redirect = request.nextUrl.searchParams.get("redirect") || "/restaurante";

  // CSRF state token — stored in a short-lived cookie on apex domain
  const state = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set("menusj_oauth_state", JSON.stringify({ state, redirect }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 600, // 10 minutes
  });

  const callbackUrl = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
