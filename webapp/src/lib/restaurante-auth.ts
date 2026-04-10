import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { cookieDomain } from "./cookie-domain";
import crypto from "crypto";

const COOKIE_NAME = "menusj_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = crypto.createHash("sha256").update(password + salt).digest("hex");
  return attempt === hash;
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

// Session now stores userId + active restaurant slug
export async function createSession(userId: string, activeSlug?: string) {
  const token = generateToken();
  const meta = await getRequestMeta();

  // Store session in DB
  await prisma.session.create({
    data: {
      userId,
      token,
      type: "OWNER",
      expiresAt: new Date(Date.now() + COOKIE_MAX_AGE * 1000),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  // We store the activeSlug in the cookie alongside the token (lightweight, not secret)
  const cookieValue = activeSlug ? `${token}:${activeSlug}` : token;

  const cookieStore = await cookies();
  const domain = await cookieDomain();
  cookieStore.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: COOKIE_MAX_AGE,
  });
  // Clear admin session when logging in as a regular user.
  cookieStore.set("menusj_admin", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
  return token;
}

// Also keep old name for backward compat during transition
export const createRestauranteSession = async (slug: string) => {
  // Find user by slug
  const dealer = await prisma.dealer.findUnique({
    where: { slug },
    include: { account: true },
  });
  if (dealer) {
    await createSession(dealer.account.userId, slug);
  }
};

export type SessionData = {
  userId: string;
  activeSlug: string | null;
};

// Parse cookie value — supports new "token:slug" format and plain token
function parseCookieValue(raw: string): { token: string; activeSlug: string | null } | null {
  if (!raw) return null;

  // New format: hex_token or hex_token:slug
  // Hex tokens are 64 chars (32 bytes)
  if (/^[a-f0-9]{64}/.test(raw)) {
    const colonIdx = raw.indexOf(":", 64);
    if (colonIdx === 64) {
      return { token: raw.substring(0, 64), activeSlug: raw.substring(65) || null };
    }
    return { token: raw.substring(0, 64), activeSlug: null };
  }

  // Old base64 format — treat as expired (force re-login)
  return null;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  // Hard boundary: if an admin session is present, the user session is ignored.
  if (cookieStore.get("menusj_admin")?.value) return null;
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const parsed = parseCookieValue(raw);
  if (!parsed) return null;

  // Look up session in DB
  const session = await prisma.session.findUnique({
    where: { token: parsed.token },
  });

  if (!session) return null;
  if (session.type !== "OWNER") return null;
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return { userId: session.userId, activeSlug: parsed.activeSlug };
}

// Backward compat
export async function getRestauranteSession() {
  const session = await getSession();
  if (!session) return null;
  return { slug: session.activeSlug || "" };
}

// Get full user with all their restaurants + pending claims
export async function getFullSession() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      accounts: {
        where: { type: "dealer" },
        include: {
          dealer: {
            select: {
              id: true, name: true, slug: true, cuisineType: true,
              logoUrl: true, coverUrl: true, phone: true, address: true,
              description: true, isActive: true, isVerified: true,
            },
          },
        },
      },
      claimRequests: {
        where: { status: { in: ["PENDING", "CODE_SENT"] } },
        include: {
          dealer: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const restaurants = user.accounts
    .map((a) => a.dealer)
    .filter(Boolean);

  const activeRestaurant = session.activeSlug
    ? restaurants.find((r) => r!.slug === session.activeSlug) || restaurants[0]
    : restaurants[0];

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    restaurants,
    activeRestaurant: activeRestaurant || null,
    pendingClaims: user.claimRequests,
  };
}

// Get the active dealer (backward compat for existing code)
export async function getRestauranteFromSession() {
  const full = await getFullSession();
  if (!full?.activeRestaurant) return null;

  const dealer = await prisma.dealer.findUnique({
    where: { slug: full.activeRestaurant.slug },
    include: { account: { include: { user: true } } },
  });

  return dealer;
}

export async function switchActiveRestaurant(slug: string) {
  const session = await getSession();
  if (!session) return;
  // Reuse existing DB session — just update the cookie with new slug
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return;
  const parsed = parseCookieValue(raw);
  if (!parsed) return;

  const cookieValue = `${parsed.token}:${slug}`;
  const domain = await cookieDomain();
  cookieStore.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroyRestauranteSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  // Delete the DB session if we can parse the token
  if (raw) {
    const parsed = parseCookieValue(raw);
    if (parsed) {
      await prisma.session.deleteMany({ where: { token: parsed.token } }).catch(() => {});
    }
  }

  const domain = await cookieDomain();
  // Apex domain — wipes cookie across admin./www./menusanjuan.com
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
  // Also wipe any host-only cookies set before this fix was deployed.
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// Login with email + password
export async function loginWithEmail(email: string, password: string): Promise<{ slug: string; mustChangePassword: boolean } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        where: { type: "dealer" },
        include: { dealer: true },
      },
    },
  });

  if (!user) return null;
  if (!verifyPassword(password, user.password)) return null;

  const firstDealer = user.accounts[0]?.dealer;
  await createSession(user.id, firstDealer?.slug || undefined);

  return { slug: firstDealer?.slug || user.id, mustChangePassword: user.mustChangePassword };
}
