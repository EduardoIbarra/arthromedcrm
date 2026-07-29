-- AlterTable
ALTER TABLE "caja_chica_transactions" ADD COLUMN IF NOT EXISTS "original_amount" DOUBLE PRECISION;
ALTER TABLE "caja_chica_transactions" ADD COLUMN IF NOT EXISTS "returned_amount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "caja_chica_transactions" ADD COLUMN IF NOT EXISTS "return_logs" JSONB;
