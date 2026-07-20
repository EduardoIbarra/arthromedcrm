-- Ensure products.sort_order exists for official price-list ordering
ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER;
CREATE INDEX IF NOT EXISTS "products_sort_order_idx" ON "public"."products"("sort_order");
