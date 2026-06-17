// Pure server-side logic for the rewards / loyalty program. The API routes
// import from here; this file owns the transitions but doesn't know about
// HTTP. Lets us unit-test the math without spinning up Next routes.

import { prisma } from "./prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { RedemptionStatus } from "@/generated/prisma";

// Master feature-flag gate. Every route + every UI component should call
// this — if false, all rewards code is dark and routes return 404.
export function rewardsFlag(): boolean {
  return process.env.REWARDS_ENABLED === "true";
}

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Find-or-create a Customer keyed by E.164 phone. Returns the row.
 * Called from /api/orders POST so that every order links to a customer.
 * Safe to call without the rewards flag — it just creates the row.
 */
export async function upsertCustomerByPhone(phone: string, displayName?: string, tx: Tx = prisma) {
  const existing = await tx.customer.findUnique({ where: { phone } });
  if (existing) {
    if (displayName && !existing.displayName) {
      return tx.customer.update({
        where: { id: existing.id },
        data: { displayName, lastSeenAt: new Date() },
      });
    }
    return tx.customer.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
  }
  return tx.customer.create({
    data: { phone, displayName: displayName || null },
  });
}

/**
 * Increment punches when an Order transitions to DELIVERED.
 * Guarded by Order.rewardCounted so re-firing the PATCH (or admin manually
 * re-marking) can't double-count.
 *
 * - No-op if rewards flag is off.
 * - No-op if dealer has rewardsEnabled=false.
 * - No-op if dealer has no enabled RewardProgram.
 * - No-op if order has no customerId (legacy orders).
 * - No-op if order.rewardCounted is already true.
 *
 * Caller passes the same tx as the order status update so we commit-or-rollback together.
 */
export async function incrementPunchesForOrder(orderId: string, tx: Tx = prisma): Promise<void> {
  if (!rewardsFlag()) return;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      restauranteSlug: true,                     // canonical dealer link (dealerId is sparse)
      customerId: true,
      rewardCounted: true,
      status: true,
    },
  });
  if (!order || !order.customerId) return;
  if (order.rewardCounted) return;
  if (order.status !== "DELIVERED") return;

  const dealer = await tx.dealer.findUnique({
    where: { slug: order.restauranteSlug },
    select: { id: true, rewardsEnabled: true, rewardProgram: true },
  });
  if (!dealer?.rewardsEnabled || !dealer.rewardProgram?.enabled) return;

  // Atomically flag the order as counted FIRST so concurrent PATCHes
  // racing on the same orderId can't both pass the rewardCounted check.
  // Prisma update with WHERE rewardCounted=false serves as a CAS.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, rewardCounted: false },
    data: { rewardCounted: true },
  });
  if (claimed.count === 0) return; // someone else already counted it

  // Upsert progress row with an atomic increment.
  await tx.rewardProgress.upsert({
    where: {
      customerId_programId: {
        customerId: order.customerId,
        programId: dealer.rewardProgram.id,
      },
    },
    update: { punches: { increment: 1 } },
    create: {
      customerId: order.customerId,
      programId: dealer.rewardProgram.id,
      punches: 1,
    },
  });
}

/**
 * Find the active eligible program for a customer at a dealer.
 * Eligible = customer has enough punches in their progress row, AND there's
 * no active READY redemption already on file.
 */
export async function getEligibleProgramFor(customerId: string, dealerId: string) {
  if (!rewardsFlag()) return null;
  const program = await prisma.rewardProgram.findUnique({
    where: { dealerId },
    select: { id: true, name: true, description: true, punchesNeeded: true, rewardItemId: true, enabled: true, expiresInDays: true },
  });
  if (!program?.enabled) return null;

  const progress = await prisma.rewardProgress.findUnique({
    where: { customerId_programId: { customerId, programId: program.id } },
    select: { punches: true },
  });
  const punches = progress?.punches ?? 0;
  const eligible = punches >= program.punchesNeeded;

  let activeRedemption: { id: string } | null = null;
  if (eligible) {
    activeRedemption = await prisma.redemption.findFirst({
      where: { customerId, programId: program.id, status: RedemptionStatus.READY },
      select: { id: true },
    });
  }

  return { program, punches, eligible, activeRedemption };
}

/**
 * Public-facing progress lookup by phone (no auth). Used by the store-page
 * badge before the customer signs in with Google.
 */
export async function getProgressByPhoneForDealer(phone: string, dealerId: string) {
  if (!rewardsFlag()) return null;
  const customer = await prisma.customer.findUnique({ where: { phone }, select: { id: true } });
  if (!customer) {
    // Customer hasn't ordered yet. Still surface the program so the store
    // page can display the goal copy.
    const program = await prisma.rewardProgram.findUnique({
      where: { dealerId },
      select: { name: true, description: true, punchesNeeded: true, enabled: true, rewardItemId: true },
    });
    if (!program?.enabled) return null;
    return { program, punches: 0, eligible: false, activeRedemption: null };
  }
  return getEligibleProgramFor(customer.id, dealerId);
}

/**
 * Create a READY Redemption for a customer who's eligible. Throws if not
 * eligible. Decrement punches by punchesNeeded inside the same tx so the
 * customer can't double-claim.
 */
export async function createRedemption(customerId: string, dealerId: string) {
  if (!rewardsFlag()) throw new Error("rewards_disabled");
  return prisma.$transaction(async (tx) => {
    const program = await tx.rewardProgram.findUnique({
      where: { dealerId },
      select: { id: true, punchesNeeded: true, expiresInDays: true, enabled: true },
    });
    if (!program?.enabled) throw new Error("program_disabled");

    const progress = await tx.rewardProgress.findUnique({
      where: { customerId_programId: { customerId, programId: program.id } },
      select: { punches: true },
    });
    if (!progress || progress.punches < program.punchesNeeded) throw new Error("not_eligible");

    // Already an open READY redemption? Don't issue another.
    const existing = await tx.redemption.findFirst({
      where: { customerId, programId: program.id, status: RedemptionStatus.READY },
      select: { id: true },
    });
    if (existing) return existing;

    // Spend the punches.
    await tx.rewardProgress.update({
      where: { customerId_programId: { customerId, programId: program.id } },
      data: { punches: { decrement: program.punchesNeeded } },
    });

    const expiresAt = new Date(Date.now() + program.expiresInDays * 24 * 60 * 60 * 1000);
    const created = await tx.redemption.create({
      data: {
        customerId,
        programId: program.id,
        status: RedemptionStatus.READY,
        expiresAt,
      },
      select: { id: true },
    });
    return created;
  });
}

/**
 * Owner-side query: top N customers near the prize for a dealer.
 * Used by /restaurante/rewards. Returns masked phones for privacy.
 */
export async function getTopProgressForDealer(dealerId: string, limit = 10) {
  if (!rewardsFlag()) return [];
  const program = await prisma.rewardProgram.findUnique({
    where: { dealerId },
    select: { id: true },
  });
  if (!program) return [];

  const rows = await prisma.rewardProgress.findMany({
    where: { programId: program.id },
    orderBy: { punches: "desc" },
    take: limit,
    select: {
      punches: true,
      customer: { select: { phone: true, displayName: true } },
    },
  });
  return rows.map((r) => ({
    punches: r.punches,
    name: r.customer.displayName,
    maskedPhone: maskPhone(r.customer.phone),
  }));
}

function maskPhone(phone: string): string {
  // E.164 like +542644030485 → "+54 9 264... 0485"
  if (phone.startsWith("google:")) return "—";
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 6)}... ${phone.slice(-4)}`;
}
