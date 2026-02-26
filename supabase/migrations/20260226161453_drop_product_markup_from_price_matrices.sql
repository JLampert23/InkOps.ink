/*
  # Remove Product Markup from Price Matrices

  1. Changes
    - Drop column `product_markup_percentage` from price_matrices table
    - This column is no longer used - markup is now company-level

  2. Rationale
    - Garment markup is now stored in company_settings.default_garment_markup
    - Per-matrix markup was confusing (tied to imprint type, not garment)
    - Centralizing simplifies pricing logic

  3. Migration Safety
    - Uses IF EXISTS to prevent errors if column already dropped
    - Data in this column is not migrated (was rarely used)
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_matrices' AND column_name = 'product_markup_percentage'
  ) THEN
    ALTER TABLE price_matrices DROP COLUMN product_markup_percentage;
  END IF;
END $$;
