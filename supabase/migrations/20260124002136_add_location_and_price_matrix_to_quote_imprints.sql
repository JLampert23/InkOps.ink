/*
  # Add Location and Price Matrix to Quote Imprints

  1. Changes
    - Add `location` field to store the physical location of the imprint (Front, Back, Left Chest, etc.)
    - Add `price_matrix_id` field to link to the price_matrices table
    - The `matrix` field will now store the price matrix name for reference

  2. Notes
    - location: Physical placement on garment
    - price_matrix_id: UUID reference to price_matrices table for pricing lookup
    - Existing matrix field can still be used to store the matrix name
*/

ALTER TABLE quote_imprints
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS price_matrix_id uuid REFERENCES price_matrices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_imprints_price_matrix_id ON quote_imprints(price_matrix_id);
