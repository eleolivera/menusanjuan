import { prisma } from "./prisma";
import { cookies } from "next/headers";

const COOKIE_NAME = "menusj_admin";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function createAdminSession(userId: string) {
  const token = Buffer.from(JSON.stringify({ userId, role: "ADMIN", ts: Date.now() })).toString("base64");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  // Clear user session when logging in as admin
  cookieStore.delete("menusj_session");
  return token;
}

export async function getAdminSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const data = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (!data.userId) return null;

    // Verify user still has ADMIN role
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user || user.role !== "ADMIN") return null;

    return { userId: user.id };
  } catch {
    return null;
  }
}

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") return false;

  // Verify password
  const [salt, hash] = user.password.split(":");
  const crypto = require("crypto");
  const attempt = crypto.createHash("sha256").update(password + salt).digest("hex");
  if (attempt !== hash) return false;

  await createAdminSession(user.id);
  return true;
}
