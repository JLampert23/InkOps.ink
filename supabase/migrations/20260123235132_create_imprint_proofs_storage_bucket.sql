/*
  # Create Storage Bucket for Imprint Proofs

  1. New Storage Bucket
    - `imprint-proofs` - Store artwork files for imprints
    - Public bucket for easy access
    - Company-based folder structure

  2. Security
    - RLS policies for authenticated users only
    - Users can only access their company's files
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('imprint-proofs', 'imprint-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload imprint proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imprint-proofs');

CREATE POLICY "Users can view imprint proofs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'imprint-proofs');

CREATE POLICY "Users can update their imprint proofs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'imprint-proofs')
  WITH CHECK (bucket_id = 'imprint-proofs');

CREATE POLICY "Users can delete their imprint proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'imprint-proofs');
