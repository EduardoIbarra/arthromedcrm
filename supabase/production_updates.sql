-- 1. Add image_urls column to products
ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "image_urls" text[] DEFAULT '{}'::text[];

-- 2. Add video_urls column to congresos
ALTER TABLE "public"."congresos" ADD COLUMN IF NOT EXISTS "video_urls" text[] DEFAULT '{}'::text[];

-- 3. Create the product_images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Set up RLS for product_images bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'product_images' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Insert' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'product_images' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Update' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'product_images' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Delete' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'product_images' );
    END IF;
END
$$;
