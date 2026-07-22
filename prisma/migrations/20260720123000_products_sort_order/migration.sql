-- Ensure productos.sort_order and products.sort_order exist
ALTER TABLE "public"."productos" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER;
ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER;
CREATE INDEX IF NOT EXISTS "productos_sort_order_idx" ON "public"."productos"("sort_order");
CREATE INDEX IF NOT EXISTS "products_sort_order_idx" ON "public"."products"("sort_order");
