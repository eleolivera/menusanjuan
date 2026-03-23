import { cookies } from "next/headers";
import { prisma } from "./prisma";
import crypto from "crypto";

const COOKIE_NAME = "menusj_restaurante";
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

export async function createRestauranteSession(slug: string) {
  const token = Buffer.from(JSON.stringify({ slug, ts: Date.now() })).toString("base64");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return token;
}

export async function getRestauranteSession(): Promise<{ slug: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const data = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (data.slug) return { slug: data.slug };
    return null;
  } catch {
    return null;
  }
}

// Get the full dealer record from the session
export async function getRestauranteFromSession() {
  const session = await getRestauranteSession();
  if (!session) return null;

  const dealer = await prisma.dealer.findUnique({
    where: { slug: session.slug },
    include: {
      account: {
        include: { user: true },
      },
    },
  });

  return dealer;
}

export async function destroyRestauranteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Login with email + password
export async function loginWithEmail(email: string, password: string): Promise<string | null> {
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

  const dealer = user.accounts[0]?.dealer;
  if (!dealer) return null;

  await createRestauranteSession(dealer.slug);
  return dealer.slug;
}
