// Pure phone-normalization helper. Kept in its own module (no Prisma / no
// server-only imports) so it can be imported from client components — most
// notably the driver PWA login page — without dragging `pg` / `prisma` into
// the browser bundle. `@/lib/rewards` re-exports this for server callers so
// the existing import sites keep working.

import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Canonicalize a raw phone string to E.164 for Customer.phone lookups.
 * AR mobile numbers ALWAYS end up as `+549…` regardless of whether the input
 * was `+54…` (no 9), plain `264…`, or already `+549…`. This is the same
 * convention formatForWhatsApp() uses, so backfilled Customers match what
 * new orders + rewards-progress lookups will produce.
 *
 * Returns null when libphonenumber can't parse the input — caller decides
 * whether to skip or fall back to raw.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw.trim(), "AR");
  if (!parsed || !parsed.isValid()) return null;
  const country = parsed.countryCallingCode;
  const national = parsed.nationalNumber;
  if (country === "54") {
    let arNum = national.replace(/^0/, "").replace(/^15/, "");
    if (!arNum.startsWith("9")) arNum = "9" + arNum;
    return `+54${arNum}`;
  }
  return parsed.number; // already E.164 for non-AR
}
