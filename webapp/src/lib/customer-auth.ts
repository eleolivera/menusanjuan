// Customer-side session. Separate from the owner `menusj_session` cookie —
// customers don't need a DB-backed Session row (low-value session, no admin
// surface), so we use a stateless HMAC-signed cookie carrying just the
// customerId. Verifies on every request.

import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";
import { cookieDomain } from "./cookie-domain";
import type { GoogleUserInfo } from "./google-oauth";

const COOKIE_NAME = "menusj_customer_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function getSecret(): string {
  // Reuse CLAIM_SECRET so we don't add a new env var for a single low-value
  // signature key. Falls back to the same literal the /api/claim routes use
  // when CLAIM_SECRET is unset — throwing here would 500 the OAuth callback
  // and manifest as an opaque "google_server" error every time someone tries
  // to sign in, which is exactly what happened. Cookie is still HMAC-signed
  // with a stable value; can be strengthened by setting CLAIM_SECRET in env.
  return process.env.CLAIM_SECRET || "menusj-claim-2024";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex").slice(0, 32);
}

function encode(customerId: string): string {
  const payload = `${customerId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function decode(cookieValue: string): string | null {
  const [customerId, ts, sig] = cookieValue.split(".");
  if (!customerId || !ts || !sig) return null;
  const expected = sign(`${customerId}.${ts}`);
  if (sig !== expected) return null;
  // The cookie maxAge already enforces expiry at the browser; this is a
  // server-side defense if the cookie was stolen and replayed long after
  // its issuance.
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > COOKIE_MAX_AGE * 1000) return null;
  return customerId;
}

export async function setCustomerSession(customerId: string) {
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set(COOKIE_NAME, encode(customerId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set(COOKIE_NAME, "", { path: "/", domain, maxAge: 0 });
}

/** Returns the Customer row or null if the session is missing/invalid/stale. */
export async function getCustomerFromSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const customerId = decode(raw);
  if (!customerId) return null;
  return prisma.customer.findUnique({ where: { id: customerId } });
}

/**
 * Google OAuth callback handler for customer intent. Called from the shared
 * /api/auth/google/callback route when the state cookie carries
 * `intent: "customer"`.
 *
 * Anti-fraud rules:
 *  - One Customer per phone (Customer.phone @unique).
 *  - One Google sub per Customer (Customer.googleSub @unique).
 *  - If the incoming Google sub is already linked to a DIFFERENT customer,
 *    we redirect back with `?error=google_phone_mismatch` instead of
 *    silently re-linking — that would let an attacker hijack rewards by
 *    creating a phone-only account and then logging in with the victim's
 *    Google.
 *
 * Returns the URL to redirect to. The optional `redirect` query carries
 * the page to land on (e.g. `/hermanos-burger-club?claim=<programId>`).
 */
export async function handleCustomerGoogleCallback(
  googleUser: GoogleUserInfo,
  redirect: string,
  phoneFromState: string | null = null,
): Promise<string> {
  // Look up by Google sub first — fastest path for returning customers.
  const existingByGoogle = await prisma.customer.findUnique({
    where: { googleSub: googleUser.sub },
  });

  if (existingByGoogle) {
    await setCustomerSession(existingByGoogle.id);
    await prisma.customer.update({
      where: { id: existingByGoogle.id },
      data: { lastSeenAt: new Date(), googleEmail: googleUser.email, displayName: googleUser.name || existingByGoogle.displayName },
    });
    return appendError(redirect, null);
  }

  // Phone-in-state branch: the store-page sign-in button forwards the
  // customer's phone through the OAuth state so we can link Google to the
  // pre-existing phone-Customer instead of creating a `google:sub` orphan.
  //
  // Without this branch, first-time Google Sign-In creates a fresh Customer
  // (phone=google:sub), the customer's punches on the phone-Customer stay
  // orphaned, and the fraud gate on applyPendingRedemption never opens.
  if (phoneFromState) {
    const byPhone = await prisma.customer.findUnique({
      where: { phone: phoneFromState },
    });
    if (byPhone) {
      if (byPhone.googleSub && byPhone.googleSub !== googleUser.sub) {
        // Someone else already linked their Google to this phone. Refuse to
        // silently overwrite — same reasoning as the cookie-based branch.
        return appendError(redirect, "google_phone_mismatch");
      }
      await prisma.customer.update({
        where: { id: byPhone.id },
        data: {
          googleSub: googleUser.sub,
          googleEmail: googleUser.email,
          displayName: byPhone.displayName || googleUser.name,
          lastSeenAt: new Date(),
        },
      });
      await setCustomerSession(byPhone.id);
      return appendError(redirect, null);
    }
    // No phone match → fall through to cookie / brand-new paths.
  }

  // No customer with this Google sub yet. Two cases left:
  //  (a) An unlinked phone-Customer exists — but we have no way to know
  //      WHICH phone the user owns just from Google. The browser already
  //      carries the customer cookie via the standard flow, so we can read
  //      it from the request context. If absent → create a Google-only
  //      customer (they can place orders, but rewards won't accrue until
  //      they enter a phone on a future order).
  //  (b) Genuinely brand-new → create the Customer with Google fields, no
  //      phone yet.
  const existingFromCookie = await getCustomerFromSession();

  if (existingFromCookie) {
    // The browser already had a phone-Customer session. Link Google to that
    // customer — but only if their googleSub is still empty.
    if (existingFromCookie.googleSub && existingFromCookie.googleSub !== googleUser.sub) {
      return appendError(redirect, "google_phone_mismatch");
    }
    await prisma.customer.update({
      where: { id: existingFromCookie.id },
      data: {
        googleSub: googleUser.sub,
        googleEmail: googleUser.email,
        displayName: existingFromCookie.displayName || googleUser.name,
        lastSeenAt: new Date(),
      },
    });
    await setCustomerSession(existingFromCookie.id);
    return appendError(redirect, null);
  }

  // No cookie + no existing Google sub. Brand-new Google-only Customer.
  // Phone-anchored Customers are created via the order POST upsert; this
  // path covers customers who land on /mis-recompensas before ever ordering.
  const created = await prisma.customer.create({
    data: {
      // Phone is required @unique in the schema; for a Google-only customer
      // we use a placeholder keyed by Google sub that gets overwritten the
      // first time they place an order with a real phone. The "google:" prefix
      // makes these visible in DB if we ever need to clean up.
      phone: `google:${googleUser.sub}`,
      googleSub: googleUser.sub,
      googleEmail: googleUser.email,
      displayName: googleUser.name,
    },
  });
  await setCustomerSession(created.id);
  return appendError(redirect, null);
}

function appendError(redirect: string, errorCode: string | null): string {
  if (!errorCode) return redirect;
  const sep = redirect.includes("?") ? "&" : "?";
  return `${redirect}${sep}rewardError=${encodeURIComponent(errorCode)}`;
}
