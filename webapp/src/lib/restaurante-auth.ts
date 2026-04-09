import { cookies } from "next/headers";
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
  const attempt = crypto.createHash("sha256").update(password + salt).digest("hex");
  return attempt === hash;
}

// Session now stores userId + active restaurant slug
export async function createSession(userId: string, activeSlug?: string) {
  const token = Buffer.from(JSON.stringify({ userId, activeSlug: activeSlug || null, ts: Date.now() })).toString("base64");
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

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  // Hard boundary: if an admin session is present, the user session is ignored.
  // Admins must never be treated as a restaurant owner or a customer — they use
  // the admin panel. This prevents an admin from accidentally claiming,
  // registering, or acting as a restaurant via UI drift between tabs/devices.
  if (cookieStore.get("menusj_admin")?.value) return null;
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const data = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    // Support old format (just slug) and new format (userId + activeSlug)
    if (data.userId) return { userId: data.userId, activeSlug: data.activeSlug || null };
    if (data.slug) {
      // Old format — look up userId from slug
      const dealer = await prisma.dealer.findUnique({
        where: { slug: data.slug },
        include: { account: true },
      });
      if (dealer) return { userId: dealer.account.userId, activeSlug: data.slug };
    }
    return null;
  } catch {
    return null;
  }
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
  await createSession(session.userId, slug);
}

export async function destroyRestauranteSession() {
  const cookieStore = await cookies();
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
