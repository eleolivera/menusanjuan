// Idempotent backfill: seed a role="OWNER" DealerMember row for every existing
// (Dealer, Account.userId) pair. Safe to re-run — ON CONFLICT DO NOTHING via
// the unique (dealerId, userId) index. Ran once during Deploy A of the
// multi-user rollout; kept in the repo so a fresh clone or a follow-up
// ownership churn can re-seed missing rows without a DB dump.
//
// Run: cd webapp && npx tsx --env-file=.env src/scripts/backfill-dealer-members.ts
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await prisma.$queryRawUnsafe<Array<{ inserted: number }>>(`
    WITH ins AS (
      INSERT INTO "DealerMember" (id, "dealerId", "userId", role, "createdAt")
      SELECT concat('cm', md5(random()::text || clock_timestamp()::text)),
             d.id, a."userId", 'OWNER', NOW()
      FROM "Dealer" d JOIN "Account" a ON a.id = d."accountId"
      ON CONFLICT ("dealerId", "userId") DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted FROM ins;
  `);
  const inserted = result[0]?.inserted ?? 0;

  const [{ dealers, owners }] = await prisma.$queryRawUnsafe<Array<{ dealers: bigint; owners: bigint }>>(`
    SELECT
      (SELECT COUNT(*) FROM "Dealer") AS dealers,
      (SELECT COUNT(*) FROM "DealerMember" WHERE role = 'OWNER') AS owners;
  `);

  console.log(JSON.stringify({
    inserted,
    dealers: Number(dealers),
    ownerMembers: Number(owners),
    invariantHolds: Number(dealers) === Number(owners),
  }));

  if (Number(dealers) !== Number(owners)) {
    console.error("INVARIANT VIOLATED: dealers != owner members. Investigate.");
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
