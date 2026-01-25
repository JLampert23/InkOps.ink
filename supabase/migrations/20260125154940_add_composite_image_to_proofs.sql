/*
  # Add Composite Image Support to Proofs

  1. Schema Changes
    - Add `composite_image_url` column to `proofs` table to store the final combined garment + artwork image

  2. Storage
    - Create storage bucket for composite proof images
    - Enable RLS policies for authenticated users
*/

-- Add composite_image_url column to proofs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'composite_image_url'
  ) THEN
    ALTER TABLE proofs ADD COLUMN composite_image_url text;
  END IF;
END $$;

-- Create storage bucket for composite proof images
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-composites', 'proof-composites', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload composite proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view composite proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own composite proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own composite proofs" ON storage.objects;

-- Enable RLS for proof-composites bucket
CREATE POLICY "Authenticated users can upload composite proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proof-composites');

CREATE POLICY "Anyone can view composite proofs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'proof-composites');

CREATE POLICY "Users can update their own composite proofs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'proof-composites' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own composite proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'proof-composites' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );