// Driver-side session for the Repartidor PWA.
//
// Mirrors the same stateless HMAC pattern as `customer-auth.ts` — we don't
// need a DB-backed Session row for drivers because Driver.id + the cookie
// signature is enough to prove identity. Cookie is scoped to the apex domain
// via `cookieDomain()` so it works across www / admin / (root) hosts, exactly
// like the owner and customer cookies.
//
// Contract:
//   Payload JSON  : { driverId, issuedAt }  (issuedAt in seconds since epoch)
//   Wire format   : base64url(payload) + "." + base64url(hmacSha256Bytes)
//   Comparison    : constant-time on the HMAC bytes (crypto.timingSafeEqual)
//   Expiry        : 30 days; also rejects tokens with negative age (clock skew /
//                   tampering).
//
// Env resolution mirrors customer-auth.ts: DRIVER_SESSION_SECRET is preferred,
// CLAIM_SECRET is the shared codebase fallback, and a hardcoded value keeps
// login working in dev if neither is set (matches the customer flow so a
// missing env doesn't 500 the login endpoint).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { cookieDomain } from "./cookie-domain";

const COOKIE_NAME = "msj_driver_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return (
    process.env.DRIVER_SESSION_SECRET ||
    process.env.CLAIM_SECRET ||
    "menusj-claim-2024"
  );
}

function hmac(payloadB64: string): Buffer {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest();
}

export function signDriverSession(driverId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ driverId, issuedAt });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sigB64 = hmac(payloadB64).toString("base64url");
  return `${payloadB64}.${sigB64}`;
}

export function verifyDriverSession(
  token: string,
): { driverId: string; issuedAt: number } | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  const expected = hmac(payloadB64);
  if (sigBuf.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expected)) return null;

  let raw: unknown;
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof (raw as { driverId?: unknown }).driverId !== "string" ||
    typeof (raw as { issuedAt?: unknown }).issuedAt !== "number"
  ) {
    return null;
  }
  const { driverId, issuedAt } = raw as { driverId: string; issuedAt: number };
  if (!Number.isFinite(issuedAt)) return null;

  const ageSec = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSec < 0) return null;
  if (ageSec > COOKIE_MAX_AGE) return null;

  return { driverId, issuedAt };
}

export async function getDriverSession(): Promise<{ driverId: string } | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parsed = verifyDriverSession(raw);
  if (!parsed) return null;
  return { driverId: parsed.driverId };
}

export async function requireDriverSession(): Promise<{ driverId: string }> {
  const session = await getDriverSession();
  if (!session) redirect("/repartidor/login");
  return session;
}

export async function setDriverSessionCookie(driverId: string): Promise<void> {
  const store = await cookies();
  const domain = await cookieDomain();
  store.set(COOKIE_NAME, signDriverSession(driverId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearDriverSessionCookie(): Promise<void> {
  const store = await cookies();
  const domain = await cookieDomain();
  // Set an empty value with maxAge:0 rather than `delete()` so the same
  // apex-domain attribute is used — a bare delete() would try to remove a
  // host-scoped cookie and leave the apex-domain one behind on production.
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
}
