-- Add cantidad_real column to factura_compra_items
ALTER TABLE "public"."factura_compra_items" 
ADD COLUMN IF NOT EXISTS "cantidad_real" INTEGER NOT NULL DEFAULT 0;
