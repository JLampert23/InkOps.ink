/*
  # Add Report URL to Fundraising Credits

  1. Schema Changes
    - Add `report_url` column to `customer_fundraising_credits` table
      - Stores the URL of uploaded PDF reports
      - Optional field (can be null if no report uploaded yet)

  2. Storage Setup
    - Create `fundraising-reports` storage bucket
    - Enable public access for viewing uploaded reports
    - Set appropriate file size limits and allowed MIME types
*/

-- Add report_url column to customer_fundraising_credits table
ALTER TABLE customer_fundraising_credits 
ADD COLUMN IF NOT EXISTS report_url text;

-- Create storage bucket for fundraising reports if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fundraising-reports',
  'fundraising-reports',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for authenticated users to upload files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload fundraising reports for their company'
  ) THEN
    CREATE POLICY "Users can upload fundraising reports for their company"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'fundraising-reports' AND
        (storage.foldername(name))[1] IN (
          SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create storage policy for authenticated users to view files in their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view fundraising reports for their company'
  ) THEN
    CREATE POLICY "Users can view fundraising reports for their company"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'fundraising-reports' AND
        (storage.foldername(name))[1] IN (
          SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create storage policy for authenticated users to delete files in their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete fundraising reports for their company'
  ) THEN
    CREATE POLICY "Users can delete fundraising reports for their company"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'fundraising-reports' AND
        (storage.foldername(name))[1] IN (
          SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
