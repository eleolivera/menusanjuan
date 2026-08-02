import { prisma } from "./prisma";
import { cookies, headers } from "next/headers";
import { cookieDomain } from "./cookie-domain";
import crypto from "crypto";

const COOKIE_NAME = "menusj_admin";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// Impersonation cookie — set alongside menusj_admin when admin taps
// "Ver como dueño" on a specific dealer. HMAC-signed so a client can't
// craft one. Only honored by getSession() when the admin cookie is ALSO
// valid — losing the admin session kills impersonation implicitly.
const IMPERSONATE_COOKIE_NAME = "menusj_admin_as";
const IMPERSONATE_MAX_AGE = 4 * 60 * 60; // 4 hours

function impersonateSecret(): string {
  return (
    process.env.IMPERSONATE_SECRET ||
    process.env.CLAIM_SECRET ||
    "menusj-claim-2024"
  );
}

function impHmac(payloadB64: string): Buffer {
  return crypto.createHmac("sha256", impersonateSecret()).update(payloadB64).digest();
}

export type ImpersonationPayload = {
  adminUserId: string;
  ownerUserId: string;
  dealerSlug: string;
  issuedAt: number; // seconds since epoch
};

export function signImpersonation(payload: ImpersonationPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = impHmac(payloadB64).toString("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyImpersonation(token: string): ImpersonationPayload | null {
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
  const expected = impHmac(payloadB64);
  if (sigBuf.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expected)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof (raw as ImpersonationPayload).adminUserId !== "string" ||
    typeof (raw as ImpersonationPayload).ownerUserId !== "string" ||
    typeof (raw as ImpersonationPayload).dealerSlug !== "string" ||
    typeof (raw as ImpersonationPayload).issuedAt !== "number"
  ) {
    return null;
  }
  const p = raw as ImpersonationPayload;
  const ageSec = Math.floor(Date.now() / 1000) - p.issuedAt;
  if (ageSec < 0 || ageSec > IMPERSONATE_MAX_AGE) return null;
  return p;
}

export async function setImpersonationCookie(payload: Omit<ImpersonationPayload, "issuedAt">) {
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  const token = signImpersonation({
    ...payload,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  cookieStore.set(IMPERSONATE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: IMPERSONATE_MAX_AGE,
  });
}

export async function clearImpersonationCookie() {
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set(IMPERSONATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
  // Host-only variant defensively
  cookieStore.set(IMPERSONATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// Returns the impersonation payload IF (a) an admin cookie is present + valid
// and (b) the impersonation cookie is present + signature valid + not expired.
// This is the single truth for "is the admin currently impersonating an owner?".
export async function getActiveImpersonation(): Promise<ImpersonationPayload | null> {
  const admin = await getAdminSession();
  if (!admin) return null; // impersonation dies with the admin session
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATE_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifyImpersonation(raw);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function getRequestMeta(): Promise<{ ipAddress?: string; userAgent?: string }> {
  try {
    const h = await headers();
    return {
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
      userAgent: h.get("user-agent") || undefined,
    };
  } catch {
    return {};
  }
}

export async function createAdminSession(userId: string) {
  const token = generateToken();
  const meta = await getRequestMeta();

  await prisma.session.create({
    data: {
      userId,
      token,
      type: "ADMIN",
      expiresAt: new Date(Date.now() + COOKIE_MAX_AGE * 1000),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: COOKIE_MAX_AGE,
  });
  // Clear user session when logging in as admin.
  cookieStore.set("menusj_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
  return token;
}

// Check admin session — validates against DB
export async function getAdminSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  // New format: 64-char hex token
  if (/^[a-f0-9]{64}$/.test(token)) {
    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (!session) return null;
    if (session.type !== "ADMIN") return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    return { userId: session.userId };
  }

  // Old base64 format — treat as expired
  return null;
}

// Full admin session check WITH DB user verification (use for sensitive operations)
export async function verifyAdminSession(): Promise<{ userId: string } | null> {
  const session = await getAdminSession();
  if (!session) return null;

  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.role !== "ADMIN") {
      // User is no longer an admin — destroy the session
      const cookieStore = await cookies();
      const token = cookieStore.get(COOKIE_NAME)?.value;
      if (token) {
        await prisma.session.deleteMany({ where: { token } }).catch(() => {});
      }
      cookieStore.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        domain: await cookieDomain(),
        maxAge: 0,
      });
      return null;
    }
    return { userId: user.id };
  } catch {
    // DB error — trust the session rather than locking the admin out
    return session;
  }
}

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") return false;

  const [salt, hash] = user.password.split(":");
  if (!salt || !hash) return false;
  const attempt = crypto.createHash("sha256").update(password + salt).digest("hex");
  if (attempt !== hash) return false;

  await createAdminSession(user.id);
  return true;
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  // Delete the DB session
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }

  const domain = await cookieDomain();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
  // Also delete host-only variants
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
