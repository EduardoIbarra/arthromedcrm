-- Add status column to facturas_compra table
ALTER TABLE "public"."facturas_compra" 
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) NOT NULL DEFAULT 'Creado';

-- Index for status
CREATE INDEX IF NOT EXISTS "facturas_compra_status_idx" ON "public"."facturas_compra"("status");
