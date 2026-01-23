/*
  # Add Type and Setup Fees to Price Matrices

  1. Changes
    - Add `matrix_type` field to categorize matrices (screen print, embroidery, DTG, etc.)
    - Add `setup_fee` field for one-time setup costs
    - Add `color_count_adjustments` jsonb field for price adjustments based on color count
    - Keep existing columns/rows/cells structure for flexible tier pricing

  2. Notes
    - matrix_type helps organize different printing methods
    - setup_fee can be applied once per order
    - color_count_adjustments allows pricing like: +$1 for each additional color
    - Existing structure supports quantity tiers via rows (e.g., 1-24, 25-49, 50-99)
      and size/variant tiers via columns (e.g., S, M, L, XL, 2XL)
*/

ALTER TABLE price_matrices
  ADD COLUMN IF NOT EXISTS matrix_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS setup_fee numeric(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS color_count_adjustments jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_price_matrices_type ON price_matrices(company_id, matrix_type);

COMMENT ON COLUMN price_matrices.matrix_type IS 'Type of pricing: screen_print, embroidery, dtg, vinyl, sublimation, general, etc.';
COMMENT ON COLUMN price_matrices.setup_fee IS 'One-time setup fee for this pricing method';
COMMENT ON COLUMN price_matrices.color_count_adjustments IS 'Price adjustments per color count, e.g., {"1": 0, "2": 1.5, "3": 2.5}';
