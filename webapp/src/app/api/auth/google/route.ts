import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { cookieDomain } from "@/lib/cookie-domain";
import { normalizePhoneE164 } from "@/lib/rewards";

// GET /api/auth/google — redirect to Google OAuth consent screen
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth no configurado" }, { status: 500 });
  }

  const intentRaw = request.nextUrl.searchParams.get("intent");
  const intent = intentRaw === "customer" ? "customer" : "owner";
  const redirect = request.nextUrl.searchParams.get("redirect") || (intent === "customer" ? "/" : "/restaurante");

  // Optional phone (customer intent only): links the incoming Google account
  // to the pre-existing phone-Customer instead of creating a fresh
  // `google:sub` orphan row. Canonicalize + validate before persisting; a
  // bogus phone silently falls through to the current create-new path.
  let phoneFromParam: string | null = null;
  if (intent === "customer") {
    const raw = request.nextUrl.searchParams.get("phone");
    if (raw) phoneFromParam = normalizePhoneE164(raw);
  }

  // CSRF state token — stored in a short-lived cookie on apex domain
  const state = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set("menusj_oauth_state", JSON.stringify({ state, redirect, intent, phone: phoneFromParam }), {
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
