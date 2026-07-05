// One-shot backfill: walk every Order, normalize customerPhone → canonical
// E.164, upsert Customer row, set Order.customerId. For dealers with an active
// RewardProgram, also retroactively credit punches by counting DELIVERED
// orders that pass the qualifyingItemIds filter (fail-open when no filter
// set) and stamp Order.rewardCounted=true so future re-delivers don't
// double-count.
//
// Idempotent: safe to re-run. Orders already linked (customerId != NULL) are
// skipped for the identity pass. Punches are only credited to Orders where
// rewardCounted=false — so re-running does not stack.
//
// Usage:
//   cd webapp
//   npx tsx --env-file=.env src/scripts/backfill-customers.ts [--dry-run]
//
// --dry-run: prints the plan but writes nothing.

import { prisma } from "../lib/prisma";
import { orderQualifiesForProgram } from "../lib/rewards";

// Inline normalization — mirrors the libphonenumber-js AR-mobile canonical
// form (+549{national}) but avoids the tsx/Node 24 metadata loader issue.
// This is a one-shot backfill script over historical data whose shapes we
// verified beforehand; the live upsertCustomerByPhone() path continues to use
// libphonenumber via lib/rewards.ts.
function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip all non-digits.
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // US numbers: 11 digits starting with 1.
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Argentina: various formats reduced to +549 + area + subscriber.
  if (digits.startsWith("549") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("54") && digits.length >= 11) {
    // +54{area}{sub} → +549{area}{sub}
    return `+549${digits.slice(2)}`;
  }
  // Local 10-digit (2645551234) → +549{...}
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+549${digits}`;
  // Local 11-digit starting with 15 (old mobile prefix) → strip 15 → +549{...}
  if (digits.length === 11 && digits.startsWith("15")) return `+549${digits.slice(2)}`;
  // Fallback: skip anything else (too short / weird).
  return null;
}

const DRY = process.argv.includes("--dry-run");

type OrderRow = {
  id: string;
  restauranteSlug: string;
  customerId: string | null;
  customerPhone: string;
  customerName: string | null;
  status: string;
  items: unknown;
  rewardCounted: boolean;
  createdAt: Date;
};

async function main() {
  console.log(`\n=== Customer backfill ${DRY ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  const orders = await prisma.$queryRaw<OrderRow[]>`
    SELECT id, "restauranteSlug", "customerId", "customerPhone", "customerName",
           status::text AS status, items, "rewardCounted", "createdAt"
      FROM "Order"
     WHERE "customerPhone" IS NOT NULL AND "customerPhone" <> ''
     ORDER BY "createdAt" ASC
  `;
  console.log(`Loaded ${orders.length} orders with a phone.`);

  const dealers = await prisma.dealer.findMany({
    select: {
      id: true,
      slug: true,
      rewardsEnabled: true,
      rewardProgram: {
        select: { id: true, enabled: true, qualifyingItemIds: true, punchesNeeded: true },
      },
    },
  });
  const dealerBySlug = new Map(dealers.map((d) => [d.slug, d]));

  // Group orders by canonical phone.
  const groups = new Map<string, OrderRow[]>();
  let unparseable = 0;
  for (const o of orders) {
    const canon = normalize(o.customerPhone);
    if (!canon) { unparseable++; continue; }
    if (!groups.has(canon)) groups.set(canon, []);
    groups.get(canon)!.push(o);
  }
  console.log(`Unique phones (canonicalized): ${groups.size}`);
  console.log(`Unparseable phones (orders skipped): ${unparseable}`);

  // Stats accumulators.
  let customersCreated = 0;
  let customersFound = 0;
  let ordersLinked = 0;
  let ordersAlreadyLinked = 0;
  const punchesByProgram = new Map<string, number>();          // programId → punches credited (sum across customers)
  const customersEnrolledByProgram = new Map<string, Set<string>>(); // programId → set of customer IDs

  for (const [canonPhone, phoneOrders] of groups) {
    // Pick a displayName: prefer the most recent order's customerName that's non-empty.
    const nameSource = [...phoneOrders].reverse().find((o) => (o.customerName || "").trim());
    const displayName = nameSource?.customerName?.trim() || null;

    let customer;
    if (DRY) {
      customer = { id: `dry_${canonPhone}`, phone: canonPhone, displayName };
    } else {
      const existing = await prisma.customer.findUnique({ where: { phone: canonPhone } });
      if (existing) {
        customersFound++;
        if (displayName && !existing.displayName) {
          customer = await prisma.customer.update({
            where: { id: existing.id },
            data: { displayName },
          });
        } else {
          customer = existing;
        }
      } else {
        customer = await prisma.customer.create({
          data: {
            phone: canonPhone,
            displayName,
            createdAt: phoneOrders[0].createdAt, // oldest order's ts feels right
            lastSeenAt: phoneOrders[phoneOrders.length - 1].createdAt,
          },
        });
        customersCreated++;
      }
    }

    // Link every order to this customer (idempotent — skip if already linked).
    // Group by dealer to compute retroactive punches.
    const ordersByDealer = new Map<string, OrderRow[]>();
    for (const o of phoneOrders) {
      if (o.customerId) {
        ordersAlreadyLinked++;
      } else {
        if (!DRY) {
          await prisma.order.update({
            where: { id: o.id },
            data: { customerId: customer.id },
          });
        }
        ordersLinked++;
      }
      if (!ordersByDealer.has(o.restauranteSlug)) ordersByDealer.set(o.restauranteSlug, []);
      ordersByDealer.get(o.restauranteSlug)!.push(o);
    }

    // Retroactive punches per dealer.
    for (const [slug, dOrders] of ordersByDealer) {
      const dealer = dealerBySlug.get(slug);
      if (!dealer) continue;
      const prog = dealer.rewardProgram;
      if (!dealer.rewardsEnabled || !prog?.enabled) continue;

      let credit = 0;
      const orderIdsToStamp: string[] = [];
      for (const o of dOrders) {
        if (o.status !== "DELIVERED") continue;
        if (o.rewardCounted) continue;
        if (!orderQualifiesForProgram(o.items, prog.qualifyingItemIds as unknown)) continue;
        credit++;
        orderIdsToStamp.push(o.id);
      }
      if (credit === 0) continue;

      if (!DRY) {
        // Upsert progress row atomically. Increment because a customer may
        // have orders across multiple dealer slugs in the same run (rare, but
        // e.g. Puerto Pachata Albardón vs Chimbas share slugs? No — different
        // slugs = different programs. Still: increment is safe if we ever
        // re-run partially.)
        await prisma.rewardProgress.upsert({
          where: { customerId_programId: { customerId: customer.id, programId: prog.id } },
          update: { punches: { increment: credit } },
          create: { customerId: customer.id, programId: prog.id, punches: credit },
        });
        // Stamp rewardCounted so future DELIVERED re-fires don't double-count.
        await prisma.order.updateMany({
          where: { id: { in: orderIdsToStamp } },
          data: { rewardCounted: true },
        });
      }

      punchesByProgram.set(prog.id, (punchesByProgram.get(prog.id) || 0) + credit);
      if (!customersEnrolledByProgram.has(prog.id)) customersEnrolledByProgram.set(prog.id, new Set());
      customersEnrolledByProgram.get(prog.id)!.add(customer.id);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Customers created: ${customersCreated}`);
  console.log(`Customers matched (already existed): ${customersFound}`);
  console.log(`Orders linked (customerId set): ${ordersLinked}`);
  console.log(`Orders already linked (skipped): ${ordersAlreadyLinked}`);
  console.log(`Rewards programs credited:`);
  for (const [progId, punches] of punchesByProgram) {
    const enrolled = customersEnrolledByProgram.get(progId)?.size || 0;
    console.log(`  ${progId} → ${punches} punches across ${enrolled} customers`);
  }
  if (DRY) console.log(`\n(dry-run: nothing written)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
