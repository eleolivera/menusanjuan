import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "menusj_restaurante_token";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getRestauranteFromSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          accounts: {
            include: { dealer: true },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;

  const dealer = session.user.accounts.find(
    (a) => a.type === "dealer"
  )?.dealer;

  if (!dealer) return null;

  return { user: session.user, dealer };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(COOKIE_NAME);
  }
}
