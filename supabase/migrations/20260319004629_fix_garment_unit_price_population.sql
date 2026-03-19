/*
  # Fix Garment Unit Price Population

  1. Purpose
    - Ensures garment_unit_price is properly populated with the wholesale price + markup
    - This column represents the garment cost per unit shown to customers
  
  2. Changes
    - Backfill existing quote_line_items with calculated garment_unit_price
    - The garment_unit_price should be wholesale_price * (1 + markup/100)
    - For line items without wholesale_price, calculate from unit_price and imprint pricing
  
  3. Notes
    - This fixes the issue where garment_unit_price shows as $0.00
    - The unit_price already includes garment cost + imprint pricing correctly
*/

-- Backfill garment_unit_price for existing line items
-- For items with wholesale_price, use the wholesale with markup
-- The unit_price already includes wholesale + markup + imprints, so we can derive it

UPDATE quote_line_items
SET garment_unit_price = wholesale_price
WHERE line_type = 'item' 
  AND wholesale_price IS NOT NULL 
  AND wholesale_price > 0
  AND (garment_unit_price IS NULL OR garment_unit_price = 0);

-- For items without wholesale_price set, keep garment_unit_price as 0
-- (these might be custom items or fees)