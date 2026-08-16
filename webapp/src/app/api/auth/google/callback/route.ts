import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/restaurante-auth";
import { createAdminSession } from "@/lib/admin-auth";
import { cookieDomain } from "@/lib/cookie-domain";
import { authLimiter, getClientIp } from "@/lib/rate-limit";
import { exchangeCodeForTokens, fetchGoogleUserInfo } from "@/lib/google-oauth";
import { handleCustomerGoogleCallback } from "@/lib/customer-auth";
import { setDealerOwner } from "@/lib/ownership";

// Small helper: pick the right "sorry that failed" landing page based on
// whether the OAuth flow was customer-intent or owner-intent. Customer
// intent should NEVER dump the user onto the owner login form.
function errorRedirect(
  request: NextRequest,
  errorCode: string,
  intent: string | undefined,
  customerRedirect: string | undefined,
): NextResponse {
  if (intent === "customer") {
    const dest = customerRedirect || "/";
    const sep = dest.includes("?") ? "&" : "?";
    return NextResponse.redirect(new URL(`${dest}${sep}rewardError=${encodeURIComponent(errorCode)}`, request.url));
  }
  return NextResponse.redirect(new URL(`/restaurante/login?error=${errorCode}`, request.url));
}

// GET /api/auth/google/callback — handle Google's redirect
export async function GET(request: NextRequest) {
  // Read intent/redirect up front so early-return error branches can route
  // customer-intent failures back to the store page instead of owner login.
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("menusj_oauth_state")?.value;
  let intentEarly: string | undefined;
  let redirectEarly: string | undefined;
  if (stateCookie) {
    try {
      const s = JSON.parse(stateCookie) as { intent?: string; redirect?: string };
      intentEarly = s.intent;
      redirectEarly = s.redirect;
    } catch {}
  }

  const ip = getClientIp(request);
  const limit = authLimiter(ip);
  if (!limit.allowed) {
    return errorRedirect(request, "google_rate_limit", intentEarly, redirectEarly);
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied consent
  if (error) {
    return errorRedirect(request, "google_denied", intentEarly, redirectEarly);
  }

  if (!code || !state) {
    return errorRedirect(request, "google_invalid", intentEarly, redirectEarly);
  }

  if (!stateCookie) {
    return errorRedirect(request, "google_expired", intentEarly, redirectEarly);
  }

  let savedState: { state: string; redirect: string; intent?: string; phone?: string | null };
  try {
    savedState = JSON.parse(stateCookie);
  } catch {
    return errorRedirect(request, "google_invalid", intentEarly, redirectEarly);
  }

  if (savedState.state !== state) {
    return errorRedirect(request, "google_csrf", savedState.intent, savedState.redirect);
  }

  // Clear the state cookie on apex domain
  const domain = await cookieDomain();
  cookieStore.set("menusj_oauth_state", "", { path: "/", domain, maxAge: 0 });

  try {
    const callbackUrl = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, callbackUrl);
    const googleUser = await fetchGoogleUserInfo(tokens.access_token);

    // Customer-side flow (rewards). The owner branch below only runs for the
    // default intent. Customer intent is encoded in the state cookie so the
    // attacker can't simply flip a URL param to escalate.
    if (savedState.intent === "customer") {
      const customerRedirect = await handleCustomerGoogleCallback(googleUser, savedState.redirect, savedState.phone ?? null);
      return NextResponse.redirect(new URL(customerRedirect, request.url));
    }

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/restaurante/login?error=google_no_email", request.url));
    }

    // Check if this Google account is already linked
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: googleUser.sub } },
      include: { user: { include: {
        accounts: { where: { type: "dealer" }, include: { dealer: true } },
        // Staff-only users (added via /restaurante/team) have no Account row.
        // Pull memberships so they land on their invited resta on login.
        dealerMemberships: { include: { dealer: true } },
      } } },
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
      activeSlug = existingOAuth.user.accounts[0]?.dealer?.slug
        ?? existingOAuth.user.dealerMemberships[0]?.dealer?.slug;
    } else {
      // Check if a user with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
        include: {
          accounts: { where: { type: "dealer" }, include: { dealer: true } },
          dealerMemberships: { include: { dealer: true } },
        },
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
        // Fall back to member-dealer for staff-only users pre-created via
        // the team invite endpoint.
        activeSlug = existingUser.accounts[0]?.dealer?.slug
          ?? existingUser.dealerMemberships[0]?.dealer?.slug;
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
            const oldOwnerId = pending.account.userId;
            // Transfer ownership: re-parent Account.userId + demote prior
            // OWNER DealerMember + upsert new OWNER row + promote user to
            // BUSINESS. Single transaction.
            await setDealerOwner(tx, pending.id, user.id, { markUserBusiness: true });
            await tx.dealer.update({
              where: { id: pending.id },
              data: { pendingOwnerEmail: null, isVerified: true, claimedAt: new Date() },
            });
            if (!linkedSlug) linkedSlug = pending.slug;

            // Clean up placeholder user
            const oldCount = await tx.account.count({ where: { userId: oldOwnerId } });
            if (oldCount === 0) {
              const old = await tx.user.findUnique({ where: { id: oldOwnerId } });
              if (old?.email.endsWith("@menusanjuan.com")) {
                await tx.user.delete({ where: { id: oldOwnerId } });
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
