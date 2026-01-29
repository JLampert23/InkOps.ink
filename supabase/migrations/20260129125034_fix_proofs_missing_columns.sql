/*
  # Fix Missing Columns in Proofs Tables

  1. Schema Changes
    - Add `garment_brand` column to `proofs` table
    - Add `garment_description` column to `proofs` table
    - Add `customer_artwork_id` column to `proof_artwork` table
    - Add `print_location` column to `proof_artwork` table
    - Add `width_inches` column to `proof_artwork` table
    - Add `height_inches` column to `proof_artwork` table
    - Add `sort_order` column to `proof_artwork` table

  2. Purpose
    - Fix proof save functionality in MockupGenerator component
    - Allow storing garment details in proofs
    - Enable proper artwork tracking and positioning

  3. Notes
    - All columns are nullable for backward compatibility
    - Existing proof records will continue to work
*/

-- Add garment_brand to proofs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'garment_brand'
  ) THEN
    ALTER TABLE proofs ADD COLUMN garment_brand text;
  END IF;
END $$;

-- Add garment_description to proofs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'garment_description'
  ) THEN
    ALTER TABLE proofs ADD COLUMN garment_description text;
  END IF;
END $$;

-- Add customer_artwork_id to proof_artwork table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'customer_artwork_id'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN customer_artwork_id uuid REFERENCES customer_artwork(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add print_location to proof_artwork table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'print_location'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN print_location text;
  END IF;
END $$;

-- Add width_inches to proof_artwork table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'width_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN width_inches numeric(10,2);
  END IF;
END $$;

-- Add height_inches to proof_artwork table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'height_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN height_inches numeric(10,2);
  END IF;
END $$;

-- Add sort_order to proof_artwork table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN sort_order int DEFAULT 0;
  END IF;
END $$;

-- Create index on customer_artwork_id for better query performance
CREATE INDEX IF NOT EXISTS idx_proof_artwork_customer_artwork_id ON proof_artwork(customer_artwork_id);