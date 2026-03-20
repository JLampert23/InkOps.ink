/*
  # Add discount_amount and discount_percent columns to quotes table

  1. Changes
    - Add `discount_amount` column to store fixed discount amounts
    - Add `discount_percent` column to store percentage discounts
    - These columns are needed for proper quote duplication and invoicing
  
  2. Notes
    - The existing `discount` and `discount_type` columns remain for backward compatibility
    - Frontend code and PDF exports expect these specific column names
*/

-- Add discount_amount column
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;

-- Add discount_percent column  
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN quotes.discount_amount IS 'Fixed discount amount in dollars';
COMMENT ON COLUMN quotes.discount_percent IS 'Discount percentage (0-100)';