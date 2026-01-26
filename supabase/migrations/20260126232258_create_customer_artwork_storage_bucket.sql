/*
  # Customer Artwork Storage Bucket

  1. Storage
    - Create `customer-artwork` bucket for storing uploaded files
    - Public access for viewing artwork
    - Authenticated users can upload/modify their company's artwork
  
  2. Security
    - RLS policies on storage bucket
    - File size limit: 50MB
    - Allowed file types: PNG, JPG, JPEG, PDF, EPS, AI, SVG
*/

-- Create customer-artwork storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-artwork',
  'customer-artwork',
  true,
  52428800, -- 50MB in bytes
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
    'application/postscript',
    'application/illustrator',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for customer-artwork bucket
CREATE POLICY "Anyone can view customer artwork"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-artwork');

CREATE POLICY "Authenticated users can upload customer artwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  );

CREATE POLICY "Users can update their company's customer artwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  )
  WITH CHECK (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  );

CREATE POLICY "Users can delete their company's customer artwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  );