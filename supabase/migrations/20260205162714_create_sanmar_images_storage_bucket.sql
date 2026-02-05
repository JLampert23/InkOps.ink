/*
  # Create SanMar Images Storage Bucket

  1. Storage Bucket
    - Create `sanmar-images` bucket for storing product images
    - Public access for CDN-style delivery
    - File size limits and allowed MIME types

  2. Storage Policies
    - Public read access to all images
    - Service role can upload/manage images
*/

-- Create the sanmar-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sanmar-images',
  'sanmar-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view sanmar images (public CDN)
CREATE POLICY "Public read access to sanmar images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'sanmar-images');

-- Policy: Service role can upload and manage sanmar images
CREATE POLICY "Service role can manage sanmar images"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'sanmar-images')
  WITH CHECK (bucket_id = 'sanmar-images');
