import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/restaurante-auth";
import { createAdminSession } from "@/lib/admin-auth";
import { cookieDomain } from "@/lib/cookie-domain";

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
};

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user info");
  return res.json();
}

// GET /api/auth/google/callback — handle Google's redirect
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied consent
  if (error) {
    return NextResponse.redirect(new URL("/restaurante/login?error=google_denied", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/restaurante/login?error=google_invalid", request.url));
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("menusj_oauth_state")?.value;
  if (!stateCookie) {
    return NextResponse.redirect(new URL("/restaurante/login?error=google_expired", request.url));
  }

  let savedState: { state: string; redirect: string };
  try {
    savedState = JSON.parse(stateCookie);
  } catch {
    return NextResponse.redirect(new URL("/restaurante/login?error=google_invalid", request.url));
  }

  if (savedState.state !== state) {
    return NextResponse.redirect(new URL("/restaurante/login?error=google_csrf", request.url));
  }

  // Clear the state cookie on apex domain
  const domain = await cookieDomain();
  cookieStore.set("menusj_oauth_state", "", { path: "/", domain, maxAge: 0 });

  try {
    const callbackUrl = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, callbackUrl);
    const googleUser = await getUserInfo(tokens.access_token);

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/restaurante/login?error=google_no_email", request.url));
    }

    // Check if this Google account is already linked
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: googleUser.sub } },
      include: { user: { include: { accounts: { where: { type: "dealer" }, include: { dealer: true } } } } },
    });

    let userId: string;
    let activeSlug: string | undefined;
    let redirectTo = savedState.redirect || "/restaurante";

    if (existingOAuth) {
      // Already linked — just log in
      userId = existingOAuth.userId;
      if (existingOAuth.user.role === "ADMIN") {
        await createAdminSession(userId);
        return NextResponse.redirect(new URL("https://admin.menusanjuan.com"));
      }
      activeSlug = existingOAuth.user.accounts[0]?.dealer?.slug;
    } else {
      // Check if a user with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
        include: { accounts: { where: { type: "dealer" }, include: { dealer: true } } },
      });

      if (existingUser) {
        if (existingUser.role === "ADMIN") {
          // Link Google to existing admin, create admin session
          await prisma.oAuthAccount.create({
            data: {
              userId: existingUser.id,
              provider: "google",
              providerAccountId: googleUser.sub,
              email: googleUser.email,
            },
          });
          await createAdminSession(existingUser.id);
          return NextResponse.redirect(new URL("https://admin.menusanjuan.com"));
        }
        // Link Google account to existing business/user
        await prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: "google",
            providerAccountId: googleUser.sub,
            email: googleUser.email,
          },
        });
        userId = existingUser.id;
        activeSlug = existingUser.accounts[0]?.dealer?.slug;
      } else {
        // New user — create account + auto-link pending restaurants
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: googleUser.email,
              password: "", // OAuth-only user, no password
              name: googleUser.name || googleUser.email.split("@")[0],
            },
          });

          // Check for pending restaurant assignments (same logic as register route)
          const pendingRestaurants = await tx.dealer.findMany({
            where: { pendingOwnerEmail: googleUser.email },
            include: { account: true },
          });

          let linkedSlug: string | null = null;

          for (const pending of pendingRestaurants) {
            await tx.account.update({
              where: { id: pending.account.id },
              data: { userId: user.id },
            });
            await tx.dealer.update({
              where: { id: pending.id },
              data: { pendingOwnerEmail: null, isVerified: true, claimedAt: new Date() },
            });
            await tx.user.update({
              where: { id: user.id },
              data: { role: "BUSINESS" },
            });
            if (!linkedSlug) linkedSlug = pending.slug;

            // Clean up placeholder user
            const oldCount = await tx.account.count({ where: { userId: pending.account.userId } });
            if (oldCount === 0) {
              const old = await tx.user.findUnique({ where: { id: pending.account.userId } });
              if (old?.email.endsWith("@menusanjuan.com")) {
                await tx.user.delete({ where: { id: pending.account.userId } });
              }
            }
          }

          // Create OAuth link
          await tx.oAuthAccount.create({
            data: {
              userId: user.id,
              provider: "google",
              providerAccountId: googleUser.sub,
              email: googleUser.email,
            },
          });

          return { userId: user.id, linkedSlug };
        });

        userId = result.userId;
        activeSlug = result.linkedSlug || undefined;

        // New user with linked restaurant → go to profile
        if (activeSlug) {
          redirectTo = "/restaurante/profile";
        } else {
          // New user, no restaurant → go to register to create/claim one
          redirectTo = "/restaurante/register";
        }
      }
    }

    // Create DB-backed session
    await createSession(userId, activeSlug);

    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (err: any) {
    console.error("Google OAuth error:", err.message);
    return NextResponse.redirect(new URL("/restaurante/login?error=google_server", request.url));
  }
}
