// Ownership + role helpers for the DealerMember model.
//
// Two responsibilities:
// 1. `setDealerOwner`: the single place that transfers ownership of a dealer.
//    Atomically updates Account.userId AND keeps the OWNER DealerMember row
//    in sync (deletes any prior OWNER, upserts the new one). Every callsite
//    that previously did `prisma.account.update({data:{userId}})` for an
//    ownership transfer should go through this instead.
// 2. `assertOwner` / `NotOwnerError`: cheap guard for owner-only routes
//    (team endpoints, financial-field profile edits, rewards config).
//
// Reason for centralizing: the invariant "every dealer has exactly one
// role='OWNER' DealerMember row" must never drift. If a helper is optional,
// someone will forget. Making it the only entry point makes drift impossible.

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

// Prisma's TransactionClient type — accepted so callers can compose this
// helper inside an existing `prisma.$transaction(async (tx) => ...)`.
type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Drop the current OWNER row (if any) and insert/update a new OWNER row for
 * (dealerId, newUserId). Staff members are NOT touched — a change of owner
 * doesn't kick the employees. Extracted so both `setDealerOwner` (transfer
 * ownership) and the new-dealer-creation code paths can share it.
 *
 * Idempotent: safe if newUserId is already the OWNER (rewrites the same row).
 */
export async function upsertOwnerMember(
  tx: PrismaLike,
  dealerId: string,
  newUserId: string,
  addedByUserId?: string | null,
): Promise<void> {
  await tx.dealerMember.deleteMany({
    where: { dealerId, role: "OWNER", NOT: { userId: newUserId } },
  });
  await tx.dealerMember.upsert({
    where: { dealerId_userId: { dealerId, userId: newUserId } },
    create: {
      dealerId,
      userId: newUserId,
      role: "OWNER",
      addedByUserId: addedByUserId ?? null,
    },
    update: { role: "OWNER", addedByUserId: addedByUserId ?? null },
  });
}

/**
 * Transfer ownership of a dealer to `newUserId`.
 *
 * - Updates `Account.userId` (the legacy owner FK, still consumed by many routes)
 * - Deletes any existing DealerMember(role='OWNER') for this dealer
 * - Upserts DealerMember(dealerId, userId=newUserId, role='OWNER')
 *
 * Runs atomically: pass an existing `tx` when composing inside a larger
 * transaction (e.g. claim-verify, admin-assign). Otherwise a new transaction
 * is opened.
 *
 * `addedByUserId` is optional audit metadata — pass the admin's user id
 * on admin-assign, the claimant's own id on claim-verify, etc.
 */
export async function setDealerOwner(
  db: PrismaLike,
  dealerId: string,
  newUserId: string,
  opts?: { addedByUserId?: string; markUserBusiness?: boolean },
): Promise<void> {
  const exec = async (tx: PrismaLike) => {
    // 1. Resolve the dealer's Account so we know which row to re-parent.
    const dealer = await tx.dealer.findUnique({
      where: { id: dealerId },
      select: { accountId: true },
    });
    if (!dealer) throw new Error(`setDealerOwner: dealer ${dealerId} not found`);

    // 2. Re-parent the Account. This is the legacy path many routes still
    //    read (dealer.account.user.*). Keeps working unchanged.
    await tx.account.update({
      where: { id: dealer.accountId },
      data: { userId: newUserId },
    });

    // 3. Keep DealerMember(OWNER) in sync.
    await upsertOwnerMember(tx, dealerId, newUserId, opts?.addedByUserId);

    // 5. Optionally mark the new owner's User.role as BUSINESS. Callers that
    //    know they're onboarding a real owner (register/claim/admin-assign)
    //    set this true. Admin-swap-between-existing-users doesn't.
    if (opts?.markUserBusiness) {
      await tx.user.update({
        where: { id: newUserId },
        data: { role: "BUSINESS" },
      });
    }
  };

  // If db is already a transaction client, use it directly. Otherwise open
  // a new transaction so all 5 steps commit atomically.
  if ("$transaction" in db) {
    await (db as PrismaClient).$transaction(exec);
  } else {
    await exec(db);
  }
}

// ─── Role guards ────────────────────────────────────────────────────────

/**
 * Thrown by `assertOwner` when the acting user is not the owner. Route
 * handlers catch this and return 403.
 */
export class NotOwnerError extends Error {
  constructor(message = "Solo el dueño puede realizar esta acción") {
    super(message);
    this.name = "NotOwnerError";
  }
}

/**
 * Guard: throws NotOwnerError unless `role === "OWNER"`. Meant to be used
 * inside route handlers after `getRestauranteContext()`:
 *
 *   const ctx = await getRestauranteContext();
 *   if (!ctx) return NextResponse.json({error:"No autorizado"}, {status:401});
 *   assertOwner(ctx.role);
 *   // ...owner-only mutation...
 */
export function assertOwner(role: "OWNER" | "STAFF"): void {
  if (role !== "OWNER") throw new NotOwnerError();
}

/**
 * Small convenience for API route catch blocks — maps NotOwnerError to a
 * JSON 403 and rethrows anything else.
 */
export function forbiddenIfNotOwner(err: unknown): Response | null {
  if (err instanceof NotOwnerError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

// ─── Fields the owner-only guard protects on PATCH /api/restaurante/profile
//
// Split of the dealer profile shape. STAFF can PATCH the ops-focused subset;
// OWNER-only fields (identity, financials, delivery pricing, rewards master
// toggle, delivery mode routing) require assertOwner.

export const STAFF_ALLOWED_PROFILE_FIELDS = new Set([
  "closedUntil", "openUntil",
  "deliveryEnabled", "pickupEnabled",
  "pickupHours", "deliveryHours",
  "description", "coverUrl", "logoUrl",
  "cuisineType",
]);

export function requiresOwnerRole(fieldName: string): boolean {
  return !STAFF_ALLOWED_PROFILE_FIELDS.has(fieldName);
}

/**
 * Reject a profile PATCH body if it contains any owner-only field and the
 * caller is STAFF. Returns null when the body is legal for the caller,
 * else the offending field name.
 */
export function assertProfilePatchAllowed(
  body: Record<string, unknown>,
  role: "OWNER" | "STAFF",
): void {
  if (role === "OWNER") return;
  for (const key of Object.keys(body)) {
    if (requiresOwnerRole(key)) {
      throw new NotOwnerError(`Solo el dueño puede modificar "${key}"`);
    }
  }
}

// Prisma resolves the compound-unique with this key shape:
export type DealerMemberUnique = { dealerId_userId: { dealerId: string; userId: string } };
