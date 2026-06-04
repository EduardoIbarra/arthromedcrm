-- Drop existing authenticated-only policies for product_images
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- Create public policies for product_images to allow frontend uploads with anon key
CREATE POLICY "Public Insert" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK ( bucket_id = 'product_images' );

CREATE POLICY "Public Update" 
ON storage.objects FOR UPDATE 
TO public 
USING ( bucket_id = 'product_images' );

CREATE POLICY "Public Delete" 
ON storage.objects FOR DELETE 
TO public 
USING ( bucket_id = 'product_images' );
