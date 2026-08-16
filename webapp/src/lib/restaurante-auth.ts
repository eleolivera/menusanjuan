import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { cookieDomain } from "./cookie-domain";
import { getActiveImpersonation } from "./admin-auth";
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
  // True when the admin (menusj_admin cookie) is currently "viewing as" a
  // specific dealer's owner via a signed menusj_admin_as cookie. Owner-side
  // APIs behave identically; only DashboardShell reads this to surface a
  // banner + rewire the logout button to exit impersonation.
  impersonatedByAdmin?: boolean;
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
  // If an admin is impersonating a dealer owner, synthesize an OWNER session
  // pointing at the target user/slug. Admin cookie is required — getActiveImpersonation
  // validates both the admin session AND the signed impersonation cookie.
  const imp = await getActiveImpersonation();
  if (imp) {
    return {
      userId: imp.ownerUserId,
      activeSlug: imp.dealerSlug,
      impersonatedByAdmin: true,
    };
  }
  // Otherwise: keep the hard XOR — an admin session (without impersonation)
  // means "you're operating as an admin, not any owner".
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

// Common dealer-projection used for restaurants[] entries in the switcher +
// activeRestaurant. Extracted so the Account and DealerMember loads share it.
const RESTA_SELECT = {
  id: true, name: true, slug: true, cuisineType: true,
  logoUrl: true, coverUrl: true, phone: true, address: true,
  description: true, isActive: true, isVerified: true,
  // Needed by DashboardShell to conditionally show the 'Repartidores' nav
  // entry when the resta is on OWN/HYBRID.
  deliveryMode: true,
} as const;

// Role the acting user has on a given dealer. OWNER = full access (team,
// financial fields, resta identity); STAFF = ops access only (pedidos,
// menu edits, hours, close-now, print, rewards operations). Enforced by
// assertOwner() in lib/ownership.ts on the owner-only routes.
export type MemberRole = "OWNER" | "STAFF";

// Get full user with all their restaurants (owned + membership) + pending claims
export async function getFullSession() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      accounts: {
        where: { type: "dealer" },
        include: { dealer: { select: RESTA_SELECT } },
      },
      // NEW: dealers the user was added to via /restaurante/team. Union'd
      // with `accounts` below, so a staff member sees the resta they were
      // invited to alongside any they own themselves. Backfill guarantees
      // every existing Account owner ALSO has a DealerMember(role="OWNER")
      // row, so the union always covers today's owner path.
      dealerMemberships: {
        include: { dealer: { select: RESTA_SELECT } },
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

  // Dedupe by dealer.id — Account-owner + DealerMember(role=OWNER) rows
  // point to the same dealer for existing owners; both surfacing would
  // duplicate the switcher entry. Account path wins for role attribution
  // (Account.userId is the authoritative owner regardless of what a
  // DealerMember row says, so an out-of-sync member row can't demote an
  // owner to STAFF).
  type Resta = (typeof user.accounts)[number]["dealer"] & { role: MemberRole };
  const byId = new Map<string, Resta>();
  for (const a of user.accounts) {
    if (a.dealer) byId.set(a.dealer.id, { ...a.dealer, role: "OWNER" });
  }
  for (const m of user.dealerMemberships) {
    if (!m.dealer) continue;
    if (byId.has(m.dealer.id)) continue; // Account-owner path already covered
    byId.set(m.dealer.id, { ...m.dealer, role: m.role === "OWNER" ? "OWNER" : "STAFF" });
  }
  const restaurants = Array.from(byId.values());

  const activeRestaurant = session.activeSlug
    ? restaurants.find((r) => r.slug === session.activeSlug) || restaurants[0]
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
    impersonatedByAdmin: !!session.impersonatedByAdmin,
  };
}

// Get the active dealer (backward compat for existing code — most routes).
// Access is enforced upstream by getFullSession(): activeRestaurant is only
// populated when the acting user owns the dealer OR is a DealerMember of it.
// A user with a hand-crafted cookie pointing at a slug they don't own falls
// back to their first accessible resta (never gets the requested slug).
export async function getRestauranteFromSession() {
  const full = await getFullSession();
  if (!full?.activeRestaurant) return null;

  const dealer = await prisma.dealer.findUnique({
    where: { slug: full.activeRestaurant.slug },
    include: { account: { include: { user: true } } },
  });

  return dealer;
}

// Get the active dealer WITH role + session userId, for routes that need to
// gate owner-only operations or attribute audit fields to the acting user
// (not the Account owner). Use this in the team endpoints, in profile PATCH
// (financial fields), in rewards, and anywhere `giftedByUserId`-like audit
// needs to reflect who actually pressed the button.
export async function getRestauranteContext() {
  const full = await getFullSession();
  if (!full?.activeRestaurant) return null;

  const dealer = await prisma.dealer.findUnique({
    where: { slug: full.activeRestaurant.slug },
    include: { account: { include: { user: true } } },
  });

  if (!dealer) return null;

  return {
    dealer,
    role: full.activeRestaurant.role as MemberRole,
    sessionUserId: full.user.id,
    impersonatedByAdmin: !!full.impersonatedByAdmin,
  };
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
      // Also consider member-dealers so a staff-only user (who has no
      // Account row but was added via /restaurante/team) lands on the resta
      // they were invited to instead of a stranded session with no slug.
      dealerMemberships: {
        include: { dealer: true },
      },
    },
  });

  if (!user) return null;
  if (!verifyPassword(password, user.password)) return null;

  const ownedSlug = user.accounts[0]?.dealer?.slug;
  const memberSlug = user.dealerMemberships[0]?.dealer?.slug;
  const activeSlug = ownedSlug || memberSlug;
  await createSession(user.id, activeSlug || undefined);

  return { slug: activeSlug || user.id, mustChangePassword: user.mustChangePassword };
}
