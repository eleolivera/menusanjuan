/**
 * Shared session management for San Juan projects.
 * Cookie-based sessions with Prisma backend.
 *
 * USAGE:
 *   import { createSession, getSessionUser, deleteSession } from "@/lib/shared/session";
 *
 * REQUIRES:
 *   - Prisma client with Session model (sessionToken, userId, expires)
 *   - User model with relation to sessions
 *
 * Copy this file into your project at: src/lib/shared/session.ts
 */

import { cookies } from "next/headers";

export interface SessionConfig {
  cookieName: string;          // "autosj_session" or "menusj_session"
  maxAge: number;              // Session duration in days (default: 30)
  prisma: any;                 // Prisma client instance
  userInclude?: Record<string, any>;  // What to include when fetching user
}

export async function createSession(userId: string, config: SessionConfig): Promise<string> {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + config.maxAge * 24 * 60 * 60 * 1000);

  await config.prisma.session.create({
    data: {
      id: token,
      sessionToken: token,
      userId,
      expires,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(config.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });

  return token;
}

export async function getSessionUser(config: SessionConfig) {
  const cookieStore = await cookies();
  const token = cookieStore.get(config.cookieName)?.value;
  if (!token) return null;

  const session = await config.prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        include: config.userInclude || {},
      },
    },
  });

  if (!session || session.expires < new Date()) {
    if (session) await config.prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function deleteSession(config: SessionConfig) {
  const cookieStore = await cookies();
  const token = cookieStore.get(config.cookieName)?.value;
  if (token) {
    await config.prisma.session.deleteMany({ where: { sessionToken: token } });
    cookieStore.set(config.cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}
