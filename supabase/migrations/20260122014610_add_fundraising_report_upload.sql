/*
  # Add Fundraising Report Upload Support

  1. Changes
    - Add `report_file_path` column to `customer_fundraising_credits` table to store PDF file path

  2. Storage
    - Create storage bucket for fundraising reports with appropriate policies

  3. Security
    - Users can upload reports for credits in their company
    - Users can view reports for credits in their company
*/

-- Add report_file_path column to customer_fundraising_credits
ALTER TABLE customer_fundraising_credits
ADD COLUMN IF NOT EXISTS report_file_path text;

-- Create storage bucket for fundraising reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('fundraising-reports', 'fundraising-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files to their company's folder
CREATE POLICY "Users can upload fundraising reports for their company"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fundraising-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

-- Policy: Allow authenticated users to view files from their company's folder
CREATE POLICY "Users can view fundraising reports from their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fundraising-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

-- Policy: Allow authenticated users to delete files from their company's folder
CREATE POLICY "Users can delete fundraising reports from their company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fundraising-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);