/*
  # Add imprint_id to proof_artwork table

  1. Changes
    - Add imprint_id column to proof_artwork table to link artwork to specific imprints
    - Add foreign key constraint to quote_imprints table
    - Add index for performance

  2. Notes
    - This allows each piece of artwork to be associated with a specific imprint
    - Helps track which artwork belongs to which decoration location
*/

-- Add imprint_id column to proof_artwork table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'imprint_id'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN imprint_id uuid REFERENCES quote_imprints(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proof_artwork_imprint_id'
  ) THEN
    CREATE INDEX idx_proof_artwork_imprint_id ON proof_artwork(imprint_id);
  END IF;
END $$;

COMMENT ON COLUMN proof_artwork.imprint_id IS 'Links artwork to a specific imprint/decoration location';
