// One-shot login codes for the driver PWA. Human-friendly 6-char strings
// (uppercase alphanumeric, ambiguous chars excluded). Owner adds a driver
// → generates a code → hands it to the driver via WhatsApp → driver types
// phone + code once → server sets a signed cookie and consumes the code.
//
// Codes have a 7-day TTL so a lost code (owner forgot to hand it over)
// doesn't linger forever. Owner can regenerate any time.

import crypto from "crypto";

// Skip 0/O/1/I to reduce transcription errors.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LEN = 6;

export function generateDriverLoginCode(): string {
  const bytes = crypto.randomBytes(LEN);
  let out = "";
  for (let i = 0; i < LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Standard TTL for a freshly-issued driver code: 7 days from now. */
export function driverCodeExpiry(daysFromNow = 7): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}
