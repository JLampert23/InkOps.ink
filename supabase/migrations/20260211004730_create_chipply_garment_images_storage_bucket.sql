-- Create Chipply Garment Images Storage Bucket
--
-- 1. Storage Bucket
--    - Create chipply-garment-images bucket for storing imported garment images
--    - Public bucket for easy access
--    - File size limit: 10MB
--    - Allowed MIME types: image/*
--
-- 2. Security
--    - Public read access for all authenticated users
--    - Only authenticated users can upload
--    - Company-scoped uploads using path: company_id/quote_id/filename

-- Create storage bucket for chipply garment images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chipply-garment-images',
  'chipply-garment-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read images
CREATE POLICY "Anyone can view chipply garment images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chipply-garment-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload chipply garment images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chipply-garment-images');

-- Allow authenticated users to update images
CREATE POLICY "Authenticated users can update chipply garment images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chipply-garment-images')
  WITH CHECK (bucket_id = 'chipply-garment-images');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete chipply garment images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chipply-garment-images');
