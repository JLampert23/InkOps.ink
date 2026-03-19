/*
  # Add price locking to quote line items

  1. Changes
    - Add `price_locked` boolean column to `quote_line_items` table
    - Default to false for existing records
    - Add index for performance

  2. Purpose
    - Prevent automatic price recalculation when loading duplicated quotes
    - Preserve original pricing including imprint prices
    - Allow manual unlock when prices need to be updated
*/

-- Add price_locked column
ALTER TABLE quote_line_items
ADD COLUMN IF NOT EXISTS price_locked boolean DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quote_line_items_price_locked
ON quote_line_items(price_locked)
WHERE price_locked = true;

-- Add comment
COMMENT ON COLUMN quote_line_items.price_locked IS 'When true, prevents automatic price recalculation. Used for preserving prices in duplicated quotes.';
