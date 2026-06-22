-- Referral / lead-capture MVP. Additive only — zero risk to existing flows.
BEGIN;

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'DEMO_READY', 'CONVERTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ReferralLead" (
  id               TEXT PRIMARY KEY,
  "referrerName"   TEXT NOT NULL,
  "referrerEmail"  TEXT,
  "referrerPhone"  TEXT NOT NULL,
  "referrerMpAlias" TEXT,
  "restaName"      TEXT NOT NULL,
  "restaAddress"   TEXT,
  "restaPhone"     TEXT,
  "restaInstagram" TEXT,
  "restaNotes"     TEXT,
  "menuFiles"      JSONB NOT NULL,
  stage            "LeadStage" NOT NULL DEFAULT 'SUBMITTED',
  "accessToken"    TEXT NOT NULL UNIQUE,
  "adminNotes"     TEXT,
  "rejectedReason" TEXT,
  "dealerId"       TEXT UNIQUE,
  "convertedAt"    TIMESTAMP(3),
  "rewardAmount"   DOUBLE PRECISION,
  "rewardPaidAt"   TIMESTAMP(3),
  "rewardPaidNote" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ReferralLead_stage_createdAt_idx"   ON "ReferralLead" (stage, "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralLead_accessToken_idx"        ON "ReferralLead" ("accessToken");
CREATE INDEX IF NOT EXISTS "ReferralLead_referrerEmail_idx"      ON "ReferralLead" ("referrerEmail");
CREATE INDEX IF NOT EXISTS "ReferralLead_referrerPhone_idx"      ON "ReferralLead" ("referrerPhone");

COMMIT;
