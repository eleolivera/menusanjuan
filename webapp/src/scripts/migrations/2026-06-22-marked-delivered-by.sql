-- Order.markedDeliveredBy — audit trail for which surface marked the order
-- DELIVERED. Values: 'driver' | 'owner' | 'pos' | 'print-agent'. Nullable so
-- legacy rows (and orders not yet delivered) stay null.
--
-- Additive, zero risk. Apply BEFORE deploying the code that writes this column
-- so the first DELIVERED PATCH post-deploy doesn't error.
BEGIN;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "markedDeliveredBy" TEXT;
COMMIT;
