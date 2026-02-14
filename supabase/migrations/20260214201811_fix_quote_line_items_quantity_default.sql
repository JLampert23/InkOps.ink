/*
  # Fix quote_line_items quantity column default

  This migration removes the default value from the quantity column in quote_line_items
  so it remains empty unless explicitly set by the user.

  1. Changes
    - Alter `quantity` column to be nullable (remove NOT NULL constraint)
    - Set default to NULL instead of 1
    - Update existing rows with quantity=1 to NULL (only for garment line items)

  2. Notes
    - Fee line items should keep their quantity (usually 1)
    - Only garment line items should have nullable quantity
*/

-- First, update existing garment line items that have quantity=1 to NULL
-- (fees should keep their quantity value)
UPDATE quote_line_items
SET quantity = NULL
WHERE line_type = 'garment' AND quantity = 1;

-- Alter the column to be nullable and default to NULL
ALTER TABLE quote_line_items
ALTER COLUMN quantity DROP NOT NULL,
ALTER COLUMN quantity SET DEFAULT NULL;
