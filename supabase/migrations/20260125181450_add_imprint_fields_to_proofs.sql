/*
  # Add Imprint Fields to Proofs Table

  1. Schema Changes
    - Add `type_of_work` column to link to type of work settings
    - Add `decoration_location_id` column to link to decoration locations
    - Add `pricing_matrix_id` column to link to pricing matrices
    - Add `pricing_matrix_column` column to store selected column
    - Add `imprint_unit_price` column to store calculated price per unit
    - Add `imprint_setup_fee` column to store setup fee from pricing matrix
    
  2. Purpose
    - Combine imprint configuration with proof creation
    - Allow proofs to contain full pricing and decoration information
    - Enable unified Imprint + Proof Builder workflow
    
  3. Notes
    - All new columns are nullable for backward compatibility
    - Existing proofs without imprint data will continue to work
*/

-- Add type of work reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'type_of_work'
  ) THEN
    ALTER TABLE proofs ADD COLUMN type_of_work text;
  END IF;
END $$;

-- Add decoration location reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'decoration_location_id'
  ) THEN
    ALTER TABLE proofs ADD COLUMN decoration_location_id uuid REFERENCES decoration_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add pricing matrix reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'pricing_matrix_id'
  ) THEN
    ALTER TABLE proofs ADD COLUMN pricing_matrix_id uuid REFERENCES price_matrices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add pricing matrix column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'pricing_matrix_column'
  ) THEN
    ALTER TABLE proofs ADD COLUMN pricing_matrix_column text;
  END IF;
END $$;

-- Add imprint unit price
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'imprint_unit_price'
  ) THEN
    ALTER TABLE proofs ADD COLUMN imprint_unit_price numeric(10,2);
  END IF;
END $$;

-- Add imprint setup fee
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'imprint_setup_fee'
  ) THEN
    ALTER TABLE proofs ADD COLUMN imprint_setup_fee numeric(10,2);
  END IF;
END $$;

-- Create index on decoration_location_id
CREATE INDEX IF NOT EXISTS idx_proofs_decoration_location_id ON proofs(decoration_location_id);

-- Create index on pricing_matrix_id
CREATE INDEX IF NOT EXISTS idx_proofs_pricing_matrix_id ON proofs(pricing_matrix_id);
