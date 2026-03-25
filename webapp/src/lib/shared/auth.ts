/**
 * Shared authentication utilities for San Juan projects.
 * Used by AutoSanJuan and MenuSanJuan.
 *
 * USAGE:
 *   import { hashPassword, verifyPassword, generateCode } from "@/lib/shared/auth";
 *
 * Copy this file into your project at: src/lib/shared/auth.ts
 */

// Each project should set its own salt
const DEFAULT_SALT = "sanjuan_auth_salt_2026";

/**
 * Hash a password using SHA-256 + salt.
 * NOTE: For production, upgrade to bcrypt/argon2.
 */
export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string, salt: string = DEFAULT_SALT): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

/**
 * Generate a random 6-digit numeric code.
 */
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate a deterministic claim code from a profile ID.
 * Same code every time for the same ID — admin can look it up without DB.
 */
export async function generateClaimCode(profileId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(profileId + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 3).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Verify a claim code.
 */
export async function verifyClaimCode(profileId: string, code: string, secret: string): Promise<boolean> {
  const expected = await generateClaimCode(profileId, secret);
  return code.toUpperCase() === expected;
}
