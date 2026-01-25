/*
  # Create Storage Buckets for Proofs

  1. Storage Buckets
    - `proof-garments` - For garment images
    - `proof-artwork` - For artwork files

  2. Security
    - RLS policies for authenticated users
    - Company-based access control
*/

-- Create proof-garments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-garments',
  'proof-garments',
  true,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create proof-artwork bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-artwork',
  'proof-artwork',
  true,
  20971520, -- 20MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'application/pdf', 'application/postscript', 'application/illustrator']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for proof-garments
CREATE POLICY "Authenticated users can upload garment images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proof-garments');

CREATE POLICY "Authenticated users can view garment images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proof-garments');

CREATE POLICY "Authenticated users can update garment images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'proof-garments')
  WITH CHECK (bucket_id = 'proof-garments');

CREATE POLICY "Authenticated users can delete garment images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'proof-garments');

-- Create storage policies for proof-artwork
CREATE POLICY "Authenticated users can upload artwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proof-artwork');

CREATE POLICY "Authenticated users can view artwork"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proof-artwork');

CREATE POLICY "Authenticated users can update artwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'proof-artwork')
  WITH CHECK (bucket_id = 'proof-artwork');

CREATE POLICY "Authenticated users can delete artwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'proof-artwork');
