/*
  # Add Product Markup Percentage to Price Matrices

  1. Changes
    - Add `product_markup_percentage` column to store garment markup percentage
    - Default value is 0 (no markup)
    - Used to calculate final pricing: final_price = cost * (1 + markup_percentage/100)
    - Example: 100% markup means final_price = cost * 2 (double the price)

  2. Notes
    - This markup is applied to the base garment cost
    - Stored as a percentage value (100 = 100% markup = 2x price)
*/

ALTER TABLE price_matrices
  ADD COLUMN IF NOT EXISTS product_markup_percentage numeric(10,2) DEFAULT 0.00;

COMMENT ON COLUMN price_matrices.product_markup_percentage IS 'Product markup percentage for garments. 100% = 2x price, 50% = 1.5x price';
