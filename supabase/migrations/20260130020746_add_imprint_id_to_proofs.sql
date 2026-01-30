/*
  # Link Proofs to Imprints
  
  1. Changes
    - Add `imprint_id` column to `proofs` table to directly link proofs to quote_imprints
    - Add foreign key constraint
    - Add index for performance
  
  2. Notes
    - This allows each proof to be associated with a specific imprint
    - Improves data integrity with proper foreign key relationship
*/

-- Add imprint_id column to proofs table
ALTER TABLE proofs 
ADD COLUMN IF NOT EXISTS imprint_id uuid REFERENCES quote_imprints(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_proofs_imprint_id ON proofs(imprint_id);

-- Add index on quote_imprints for group_label lookups
CREATE INDEX IF NOT EXISTS idx_quote_imprints_group_label ON quote_imprints(quote_id, group_label);