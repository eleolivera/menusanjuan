// Pure server-side logic for the rewards / loyalty program. The API routes
// import from here; this file owns the transitions but doesn't know about
// HTTP. Lets us unit-test the math without spinning up Next routes.

import { prisma } from "./prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { RedemptionStatus } from "@/generated/prisma";
import { normalizePhoneE164 } from "./phone-normalize";

// Re-exported so existing server-side callers (`@/lib/rewards`) keep working.
// The implementation lives in `./phone-normalize` — a Prisma-free module that
// is safe to import from client components (e.g. the driver PWA login page).
export { normalizePhoneE164 };

// Master feature-flag gate. Every route + every UI component should call
// this — if false, all rewards code is dark and routes return 404.
export function rewardsFlag(): boolean {
  return process.env.REWARDS_ENABLED === "true";
}

type Tx = Prisma.TransactionClient | PrismaClient;

// `normalizePhoneE164` moved to `./phone-normalize` so it can be imported
// safely from client components. Re-exported above for backwards compat.

/**
 * Find-or-create a Customer keyed by canonical E.164 phone. Returns the row.
 * Called from /api/orders POST so that every order links to a customer.
 * Safe to call without the rewards flag — it just creates the row.
 * Falls back to the raw input if normalization fails (so callers who already
 * validated with isValidPhone still succeed).
 */
export async function upsertCustomerByPhone(phone: string, displayName?: string, tx: Tx = prisma) {
  const canonical = normalizePhoneE164(phone) || phone;
  const existing = await tx.customer.findUnique({ where: { phone: canonical } });
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
    data: { phone: canonical, displayName: displayName || null },
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
      items: true,                               // needed for qualifyingItemIds filter
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

  // Qualifying-items filter (optional per-program). NULL/empty array = all
  // orders count (legacy). When populated, at least one line (top-level or
  // promo component) must reference one of the listed MenuItem IDs.
  if (!orderQualifiesForProgram(order.items, dealer.rewardProgram.qualifyingItemIds)) {
    return;
  }

  // Atomically flag the order as counted FIRST so concurrent PATCHes
  // racing on the same orderId can't both pass the rewardCounted check.
  // Prisma update with WHERE rewardCounted=false serves as a CAS.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, rewardCounted: false },
    data: { rewardCounted: true },
  });
  if (claimed.count === 0) return; // someone else already counted it

  // Upsert progress row with an atomic increment.
  const progress = await tx.rewardProgress.upsert({
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
    select: { punches: true },
  });

  // Auto-issue Redemption when the customer hits the threshold. Best-effort:
  // any failure logs but never bubbles up (order status flip is more
  // important than rewards issuance).
  try {
    await maybeIssueRedemption(order.customerId, dealer.rewardProgram.id, progress.punches, tx);
  } catch (err) {
    console.error("auto-issue Redemption failed:", err);
  }

  // Auto-finalize: if this delivered order had a Redemption attached (via
  // applyPendingRedemption at checkout), flip it READY → REDEEMED now.
  try {
    await tx.redemption.updateMany({
      where: { orderId: order.id, status: RedemptionStatus.READY },
      data: { status: RedemptionStatus.REDEEMED, redeemedAt: new Date() },
    });
  } catch (err) {
    console.error("auto-finalize Redemption failed:", err);
  }
}

/**
 * Auto-issue a READY Redemption when a customer reaches punchesNeeded.
 * Idempotent — if a READY Redemption for (customer, program) already exists,
 * this is a no-op. Punches stay in place until the redemption is consumed at
 * checkout by applyPendingRedemption(). This differs from createRedemption()
 * (which spends the punches immediately) because auto-issue reflects "you've
 * earned it, cash it in on your next order".
 */
async function maybeIssueRedemption(customerId: string, programId: string, punches: number, tx: Tx): Promise<void> {
  const program = await tx.rewardProgram.findUnique({
    where: { id: programId },
    select: { punchesNeeded: true, expiresInDays: true, enabled: true },
  });
  if (!program?.enabled) return;
  if (punches < program.punchesNeeded) return;

  const existing = await tx.redemption.findFirst({
    where: { customerId, programId, status: RedemptionStatus.READY },
    select: { id: true },
  });
  if (existing) return;

  const expiresAt = new Date(Date.now() + program.expiresInDays * 24 * 60 * 60 * 1000);
  await tx.redemption.create({
    data: {
      customerId,
      programId,
      status: RedemptionStatus.READY,
      expiresAt,
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
  const canonical = normalizePhoneE164(phone) || phone;
  const customer = await prisma.customer.findUnique({ where: { phone: canonical }, select: { id: true } });
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
 * Auto-consume a pending READY Redemption at checkout.
 *
 * Called from POST /api/orders after customerId is resolved but before
 * createOrder writes to the DB. Returns a possibly-augmented items array
 * plus (if applied) the redemption ID that later needs orderId written
 * back to it.
 *
 * Fraud guard: only applies when Customer.googleSub is set. The customer
 * must have signed in with Google at least once (from /mis-recompensas)
 * to prove ownership of the phone. This is a ONE-TIME step per customer —
 * after their first sign-in, all future redemptions auto-apply.
 *
 * Additional conditions to auto-apply:
 * - rewards flag on
 * - dealer.rewardsEnabled + program.enabled
 * - READY Redemption exists with expiresAt > now
 * - if program.redemptionRequiresItemIds is set, cart contains ≥1 listed item
 */
export async function applyPendingRedemption(params: {
  customerId: string;
  dealerId: string;
  dealerSlug: string;
  cartItems: unknown;
}): Promise<{
  items: unknown;
  redemptionId: string | null;
  rewardName: string | null;
}> {
  const passThrough = { items: params.cartItems, redemptionId: null, rewardName: null };
  if (!rewardsFlag()) return passThrough;

  // Fraud guard: customer must have proved ownership via Google Sign-In.
  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
    select: { googleSub: true },
  });
  if (!customer?.googleSub) return passThrough;

  const dealer = await prisma.dealer.findUnique({
    where: { id: params.dealerId },
    select: { rewardsEnabled: true, rewardProgram: { select: { id: true, enabled: true, rewardItemId: true, redemptionRequiresItemIds: true, rewardItem: { select: { name: true, price: true } } } } },
  });
  if (!dealer?.rewardsEnabled || !dealer.rewardProgram?.enabled) return passThrough;

  const now = new Date();
  const redemption = await prisma.redemption.findFirst({
    where: {
      customerId: params.customerId,
      programId: dealer.rewardProgram.id,
      status: RedemptionStatus.READY,
      orderId: null,                       // hasn't been attached to another order yet
      expiresAt: { gt: now },
    },
    select: { id: true, programId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!redemption) return passThrough;

  // Requires-purchase filter (optional per-program). Same helper as accrual.
  if (!orderQualifiesForProgram(params.cartItems, dealer.rewardProgram.redemptionRequiresItemIds)) {
    return passThrough;
  }

  const rewardItemName = dealer.rewardProgram.rewardItem.name;
  const rewardItemPrice = dealer.rewardProgram.rewardItem.price ?? 0;
  const rewardItemId = dealer.rewardProgram.rewardItemId;

  // Two ways the free reward can join the order — depending on whether the
  // customer already has the reward item in their cart:
  //   (A) Cart contains the reward item → apply as a DISCOUNT ($-N line) so
  //       their paid item becomes free. Matches the 'your 10th coffee free'
  //       mental model — no bonus, no double-print on the kitchen ticket.
  //   (B) Cart does NOT contain the reward item → APPEND the reward as a $0
  //       line so the customer gets a bonus item they didn't ask for.
  //
  // Discount is clamped to (subtotal - 1) so the /api/orders total > 0 check
  // stays happy even on 100%-off edge cases.
  const cartHasRewardItem = Array.isArray(params.cartItems) && (params.cartItems as Array<Record<string, unknown>>).some(
    (line) => typeof line?.menuItemId === "string" && line.menuItemId === rewardItemId
  );

  let addedLine;
  if (cartHasRewardItem && rewardItemPrice > 0) {
    // Compute subtotal so we can clamp the discount.
    const subtotal = (params.cartItems as Array<Record<string, unknown>>).reduce((s, it) => {
      const unit = typeof it?.priceOverride === "number" && it.priceOverride !== null
        ? it.priceOverride
        : (Number(it?.unitPrice) || 0) + (Number(it?.optionsDelta) || 0);
      return s + unit * (Number(it?.quantity) || 1);
    }, 0);
    const discount = Math.max(0, Math.min(subtotal - 1, Math.round(rewardItemPrice)));
    addedLine = {
      menuItemId: null,
      name: `🎁 ${rewardItemName} gratis (canje)`,
      quantity: 1,
      unitPrice: -discount,
      total: -discount,
      note: "Canje de premio de fidelidad",
    };
  } else {
    // Bonus mode — customer didn't add the reward item themselves; give it
    // as an extra at $0. Kitchen ticket + kanban card will render this as a
    // normal line thanks to the (premio) tag.
    addedLine = {
      menuItemId: rewardItemId,
      name: `🎁 ${rewardItemName} (premio)`,
      quantity: 1,
      unitPrice: 0,
      total: 0,
      note: "Canje de premio de fidelidad",
    };
  }

  const nextItems = Array.isArray(params.cartItems) ? [...params.cartItems, addedLine] : [addedLine];

  return { items: nextItems, redemptionId: redemption.id, rewardName: rewardItemName };
}

/**
 * Attach a Redemption to the Order that consumed it. Called AFTER createOrder
 * returns an id so we can write the FK. Redemption stays READY at this point;
 * it flips to REDEEMED when the order transitions to DELIVERED (handled by
 * incrementPunchesForOrder).
 *
 * Also decrement punches now — the customer has "spent" them, even though the
 * order isn't delivered yet. If the order is cancelled, a follow-up should
 * restore punches + release the Redemption (deferred for v1; cancel flow
 * doesn't touch rewards today, meaning cancelled orders quietly consume the
 * reward — acceptable for now, revisit if abuse observed).
 */
export async function attachRedemptionToOrder(redemptionId: string, orderId: string, tx: Tx = prisma): Promise<void> {
  const red = await tx.redemption.update({
    where: { id: redemptionId },
    data: { orderId },
    select: { customerId: true, programId: true, kind: true },
  });
  // Only PUNCH kinds spend RewardProgress punches. GIFT_* kinds have no
  // programId and no punch balance to decrement.
  if (red.kind !== "PUNCH" || !red.programId) return;
  const program = await tx.rewardProgram.findUnique({
    where: { id: red.programId },
    select: { punchesNeeded: true },
  });
  if (!program) return;
  await tx.rewardProgress.updateMany({
    where: { customerId: red.customerId, programId: red.programId },
    data: { punches: { decrement: program.punchesNeeded } },
  });
}

// ─── Gift redemptions (owner-driven, code-based) ─────────────────────────────

// Alphabet excludes ambiguous chars (0/O, 1/I/L) — safer for verbal + WhatsApp transmission.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_HALF_LEN = 4;

/**
 * Generate a random 8-char code formatted `XXXX-YYYY` (uppercase, unambiguous).
 * Caller is responsible for retrying on @unique collision (extremely rare with
 * 31^8 = ~850B possibilities per prefix).
 */
export function generateRedemptionCode(): string {
  const pick = () => Array.from(
    { length: CODE_HALF_LEN },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");
  return `${pick()}-${pick()}`;
}

export type GiftKind = "GIFT_ITEM" | "GIFT_DISCOUNT_PCT" | "GIFT_DISCOUNT_AMOUNT";

/**
 * Create a gift Redemption row owned by a dealer, targeted at one customer.
 * Returns { code, expiresAt } — caller (owner) sends the code to the customer
 * via WhatsApp. Customer enters it at checkout to redeem.
 *
 * The gift is idempotent per (dealer, customer, kind) at most in spirit: we
 * don't dedupe — an owner can legitimately gift the same customer multiple
 * codes. Each code is single-use because Redemption.orderId @unique.
 */
export async function createGiftRedemption(params: {
  ownerUserId: string;
  dealerId: string;
  customerId: string;
  kind: GiftKind;
  giftMenuItemId?: string;
  giftDiscountPct?: number;
  giftDiscountAmount?: number;
  giftNote?: string;
  ttlDays?: number;
}): Promise<{ id: string; code: string; expiresAt: Date }> {
  const ttl = Math.max(1, Math.min(365, params.ttlDays ?? 60));
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);

  // Validate kind-specific payload BEFORE spending code space
  if (params.kind === "GIFT_ITEM" && !params.giftMenuItemId) {
    throw new Error("giftMenuItemId required for GIFT_ITEM");
  }
  if (params.kind === "GIFT_DISCOUNT_PCT") {
    const p = params.giftDiscountPct ?? 0;
    if (p < 1 || p > 100) throw new Error("giftDiscountPct must be 1..100");
  }
  if (params.kind === "GIFT_DISCOUNT_AMOUNT") {
    const a = params.giftDiscountAmount ?? 0;
    if (a < 1) throw new Error("giftDiscountAmount must be ≥ 1");
  }

  // Retry loop for the extremely-rare code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRedemptionCode();
    try {
      const created = await prisma.redemption.create({
        data: {
          customerId: params.customerId,
          programId: null,                              // gifts don't belong to a program
          kind: params.kind,
          code,
          expiresAt,
          giftMenuItemId: params.giftMenuItemId ?? null,
          giftDiscountPct: params.giftDiscountPct ?? null,
          giftDiscountAmount: params.giftDiscountAmount ?? null,
          giftedByUserId: params.ownerUserId,
          giftNote: params.giftNote ?? null,
        },
        select: { id: true, code: true, expiresAt: true },
      });
      return created as { id: string; code: string; expiresAt: Date };
    } catch (err) {
      // Collision → retry with a fresh code. Any other error → bubble up.
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("Redemption_code_key")) throw err;
    }
  }
  throw new Error("Could not generate a unique redemption code after 5 tries");
}

/**
 * Preview a gift code against a cart — returns the line that WOULD be added
 * plus a description string for UI, without touching the DB. Used by
 * /api/rewards/preview-code so the customer can see the discount before submit.
 *
 * Also serves as the source of truth for the discount math: applyGiftAtCheckout
 * calls this with the same inputs to construct the actual $-negative line.
 */
export type GiftLine = {
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note: string;
};

export type CodePreviewResult =
  | { ok: false; error: "invalid" | "expired" | "already_used" | "not_your_dealer" | "empty_cart" }
  | { ok: true; description: string; line: GiftLine; redemptionId: string; kind: GiftKind };

export async function previewRedemptionCode(params: {
  code: string;
  dealerSlug: string;
  cartItems: unknown;
}): Promise<CodePreviewResult> {
  const normalized = params.code.trim().toUpperCase();
  if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalized)) return { ok: false, error: "invalid" };

  const red = await prisma.redemption.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      status: true,
      kind: true,
      expiresAt: true,
      orderId: true,
      giftDiscountPct: true,
      giftDiscountAmount: true,
      giftMenuItemId: true,
      customer: { select: { phone: true } },
    },
  });
  if (!red) return { ok: false, error: "invalid" };
  if (red.status !== RedemptionStatus.READY || red.orderId) return { ok: false, error: "already_used" };
  if (red.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };

  // Soft-scope: the customer this code was gifted to must have ordered from
  // THIS dealer at least once. Otherwise codes could be redeemed across restas
  // by anyone who guesses them.
  const dealer = await prisma.dealer.findUnique({
    where: { slug: params.dealerSlug },
    select: { id: true },
  });
  if (!dealer) return { ok: false, error: "invalid" };
  const anyOrder = await prisma.order.findFirst({
    where: { customerId: (await prisma.customer.findUnique({ where: { phone: red.customer.phone }, select: { id: true } }))?.id, restauranteSlug: params.dealerSlug },
    select: { id: true },
  });
  if (!anyOrder) return { ok: false, error: "not_your_dealer" };

  // Compute the line based on kind.
  const kind = red.kind as GiftKind;
  const items = Array.isArray(params.cartItems) ? params.cartItems : [];
  if (items.length === 0) return { ok: false, error: "empty_cart" };

  const subtotal = items.reduce((s: number, it: { unitPrice?: number; quantity?: number; total?: number; priceOverride?: number | null; optionsDelta?: number | null }) => {
    const unit = it.priceOverride ?? ((it.unitPrice ?? 0) + (it.optionsDelta ?? 0));
    return s + unit * (it.quantity ?? 1);
  }, 0);

  if (kind === "GIFT_ITEM") {
    const item = await prisma.menuItem.findUnique({
      where: { id: red.giftMenuItemId ?? "" },
      select: { id: true, name: true, category: { select: { dealerId: true } } },
    });
    if (!item || item.category.dealerId !== dealer.id) return { ok: false, error: "invalid" };
    return {
      ok: true,
      description: `${item.name} gratis`,
      redemptionId: red.id,
      kind,
      line: {
        menuItemId: item.id,
        name: `🎁 ${item.name} (regalo)`,
        quantity: 1,
        unitPrice: 0,
        total: 0,
        note: "Canje de código de regalo",
      },
    };
  }

  if (kind === "GIFT_DISCOUNT_PCT") {
    const pct = red.giftDiscountPct ?? 0;
    // Clamp so total stays ≥ 1 (never zero / never negative — createOrder rejects).
    const rawDiscount = Math.round(subtotal * (pct / 100));
    const discount = Math.max(0, Math.min(subtotal - 1, rawDiscount));
    return {
      ok: true,
      description: `${pct}% off — $${discount.toLocaleString("es-AR")} de descuento`,
      redemptionId: red.id,
      kind,
      line: {
        menuItemId: null,
        name: `🎁 Descuento ${pct}% (regalo)`,
        quantity: 1,
        unitPrice: -discount,
        total: -discount,
        note: "Canje de código de regalo",
      },
    };
  }

  if (kind === "GIFT_DISCOUNT_AMOUNT") {
    const amount = red.giftDiscountAmount ?? 0;
    const discount = Math.max(0, Math.min(subtotal - 1, amount));
    return {
      ok: true,
      description: `$${discount.toLocaleString("es-AR")} de descuento`,
      redemptionId: red.id,
      kind,
      line: {
        menuItemId: null,
        name: `🎁 Descuento $${amount.toLocaleString("es-AR")} (regalo)`,
        quantity: 1,
        unitPrice: -discount,
        total: -discount,
        note: "Canje de código de regalo",
      },
    };
  }

  return { ok: false, error: "invalid" };
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

/**
 * True when an order's items include at least one MenuItem ID from the
 * qualifying list. Fail-open: NULL/empty list → true (legacy behavior).
 * Malformed JSON → true (never silently kill accrual on parse error).
 */
export function orderQualifiesForProgram(orderItems: unknown, qualifyingItemIds: unknown): boolean {
  const ids = normalizeIdList(qualifyingItemIds);
  if (!ids || ids.length === 0) return true; // NULL/empty = accept all orders

  if (!Array.isArray(orderItems)) return true; // fail-open on malformed items

  const set = new Set(ids);
  for (const line of orderItems as Array<Record<string, unknown>>) {
    const topId = typeof line?.menuItemId === "string" ? line.menuItemId : null;
    if (topId && set.has(topId)) return true;

    const components = Array.isArray(line?.componentSelections) ? line.componentSelections : null;
    if (components) {
      for (const c of components as Array<Record<string, unknown>>) {
        const childId = typeof c?.childItemId === "string" ? c.childItemId : null;
        if (childId && set.has(childId)) return true;
      }
    }
  }
  return false;
}

function normalizeIdList(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  return ids;
}
