-- Create Chipply Garment Images Storage Bucket
-- This creates a public storage bucket for imported garment images
-- with public read access and authenticated write access

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

-- Allow anyone to view chipply garment images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view chipply garment images'
  ) THEN
    CREATE POLICY "Anyone can view chipply garment images"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'chipply-garment-images');
  END IF;
END $$;

-- Allow authenticated users to upload images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload chipply garment images'
  ) THEN
    CREATE POLICY "Authenticated users can upload chipply garment images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'chipply-garment-images');
  END IF;
END $$;

-- Allow authenticated users to update images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update chipply garment images'
  ) THEN
    CREATE POLICY "Authenticated users can update chipply garment images"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'chipply-garment-images')
      WITH CHECK (bucket_id = 'chipply-garment-images');
  END IF;
END $$;

-- Allow authenticated users to delete images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete chipply garment images'
  ) THEN
    CREATE POLICY "Authenticated users can delete chipply garment images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'chipply-garment-images');
  END IF;
END $$;
