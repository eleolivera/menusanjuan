import { prisma } from "./prisma";
import { cookies } from "next/headers";
import { cookieDomain } from "./cookie-domain";

const COOKIE_NAME = "menusj_admin";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function createAdminSession(userId: string) {
  const token = Buffer.from(JSON.stringify({ userId, role: "ADMIN", ts: Date.now() })).toString("base64");
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

// Check admin session — does NOT hit DB (trusts the cookie)
export async function getAdminSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const data = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (!data.userId || data.role !== "ADMIN") return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

// Full admin session check WITH DB verification (use sparingly — login, sensitive operations)
export async function verifyAdminSession(): Promise<{ userId: string } | null> {
  const session = await getAdminSession();
  if (!session) return null;

  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.role !== "ADMIN") {
      const cookieStore = await cookies();
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
    // DB error — trust the cookie rather than locking the admin out
    return session;
  }
}

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") return false;

  // Verify password
  const crypto = require("crypto");
  const [salt, hash] = user.password.split(":");
  const attempt = crypto.createHash("sha256").update(password + salt).digest("hex");
  if (attempt !== hash) return false;

  await createAdminSession(user.id);
  return true;
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const domain = await cookieDomain();
  // Delete on the apex domain (covers admin./www./menusanjuan.com)
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    maxAge: 0,
  });
  // Also delete host-only variants in case an old cookie was set without a
  // domain before this fix was deployed.
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
