-- Rewards / loyalty program: customer identity + per-resta punch programs.
-- Apply via:  cat .. | mcp run_sql  (prod)  OR  psql $DATABASE_URL -f ...
-- Idempotent: every statement guarded so re-running is safe.

BEGIN;

-- ── Customer table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Customer" (
  id              TEXT PRIMARY KEY,
  phone           TEXT NOT NULL UNIQUE,
  "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  "googleSub"     TEXT UNIQUE,
  "googleEmail"   TEXT,
  "displayName"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Customer_googleEmail_idx" ON "Customer" ("googleEmail");

-- ── RewardProgram ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RewardProgram" (
  id              TEXT PRIMARY KEY,
  "dealerId"      TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  "punchesNeeded" INTEGER NOT NULL DEFAULT 10,
  "rewardItemId"  TEXT NOT NULL,
  "expiresInDays" INTEGER NOT NULL DEFAULT 30,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardProgram_dealerId_fkey"     FOREIGN KEY ("dealerId")     REFERENCES "Dealer"(id)   ON DELETE CASCADE,
  CONSTRAINT "RewardProgram_rewardItemId_fkey" FOREIGN KEY ("rewardItemId") REFERENCES "MenuItem"(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "RewardProgram_dealerId_enabled_idx" ON "RewardProgram" ("dealerId", enabled);

-- ── RewardProgress ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RewardProgress" (
  id           TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "programId"  TEXT NOT NULL,
  punches      INTEGER NOT NULL DEFAULT 0,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardProgress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id)      ON DELETE CASCADE,
  CONSTRAINT "RewardProgress_programId_fkey"  FOREIGN KEY ("programId")  REFERENCES "RewardProgram"(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RewardProgress_customerId_programId_key" ON "RewardProgress" ("customerId", "programId");
CREATE INDEX IF NOT EXISTS "RewardProgress_programId_punches_idx" ON "RewardProgress" ("programId", punches);

-- ── Redemption ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "RedemptionStatus" AS ENUM ('READY', 'REDEEMED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Redemption" (
  id           TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "programId"  TEXT NOT NULL,
  "orderId"    TEXT UNIQUE,
  status       "RedemptionStatus" NOT NULL DEFAULT 'READY',
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3),
  CONSTRAINT "Redemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id)      ON DELETE CASCADE,
  CONSTRAINT "Redemption_programId_fkey"  FOREIGN KEY ("programId")  REFERENCES "RewardProgram"(id) ON DELETE CASCADE,
  CONSTRAINT "Redemption_orderId_fkey"    FOREIGN KEY ("orderId")    REFERENCES "Order"(id)         ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Redemption_customerId_status_idx" ON "Redemption" ("customerId", status);
CREATE INDEX IF NOT EXISTS "Redemption_programId_status_idx"  ON "Redemption" ("programId",  status);

-- ── Dealer.rewardsEnabled  (master per-dealer kill switch) ──────────────────
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "rewardsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ── Order: customerId + rewardCounted ───────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId"    TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rewardCounted" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order" ("customerId");

-- FK guarded so re-runs don't fail with "constraint already exists"
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
