import { headers } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Bearer-token auth for the desktop print agent. Plays the same role as
 * `getRestauranteFromSession` does for browser sessions, but with an
 * `Authorization: Bearer <apiKey>` header instead of a session cookie.
 *
 * The raw API key is generated server-side, shown to the owner ONCE during
 * pairing, then we store only its bcrypt hash. To look up the agent on each
 * incoming request we have to compare the presented key against every active
 * PrintAgent's hash (bcrypt is one-way — no index possible).
 *
 * At <100 paired agents project-wide this is fine; if it grows we can add a
 * deterministic short prefix and index on that to narrow the candidate set.
 */
export async function getPrintAgentFromRequest(): Promise<
  Awaited<ReturnType<typeof prisma.printAgent.findUnique>> | null
> {
  const h = await headers();
  const authHeader = h.get("authorization") || h.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
  const rawKey = authHeader.slice("bearer ".length).trim();
  if (!rawKey || rawKey.length < 16) return null;

  // Narrow candidates by the visible hint (last 4 chars). If two agents collide
  // on the hint we just check both.
  const hint = rawKey.slice(-4);
  const candidates = await prisma.printAgent.findMany({
    where: { apiKeyHint: hint, pairedAt: { not: null }, apiKeyHash: { not: null } },
  });
  for (const agent of candidates) {
    if (!agent.apiKeyHash) continue;
    if (await bcrypt.compare(rawKey, agent.apiKeyHash)) {
      return agent;
    }
  }
  return null;
}

/** Generate a fresh random API key for a new agent. 32 hex chars = 128 bits. */
export function generateApiKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Generate a short, human-typable pairing code (uppercase letters + digits, 6 chars). */
export function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit confusables (I, O, 0, 1)
  let out = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Hash a raw API key for DB storage. */
export async function hashApiKey(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10);
}
