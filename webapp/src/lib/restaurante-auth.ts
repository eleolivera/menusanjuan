// Simple shared-password auth for dev. Will be replaced with proper per-restaurant auth.
import { cookies } from "next/headers";

const RESTAURANTE_PASSWORD = "menusj2024";
const COOKIE_NAME = "menusj_restaurante";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function verifyPassword(password: string): boolean {
  return password === RESTAURANTE_PASSWORD;
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

export async function destroyRestauranteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
