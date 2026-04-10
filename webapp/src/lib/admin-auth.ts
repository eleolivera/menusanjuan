import { prisma } from "./prisma";
import { cookies, headers } from "next/headers";
import { cookieDomain } from "./cookie-domain";
import crypto from "crypto";

const COOKIE_NAME = "menusj_admin";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

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
