/*
  # Add SSActivewear Price Type Column

  1. Changes
    - Add `ssactivewear_price_type` column to `company_settings` table
    - Column stores the price type for PromoStandards API calls
    - Valid values: 'Net', 'Customer', 'Blank', 'EQP', 'List'
    - Default value: 'Net' (wholesale distributor cost)

  2. Notes
    - This determines which <shar:priceType> is used in PPC API calls
    - Net = wholesale distributor cost
    - Customer = contract pricing
*/

-- Add ssactivewear_price_type column with constraint
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS ssactivewear_price_type TEXT NOT NULL DEFAULT 'Net'
CHECK (ssactivewear_price_type IN ('Net', 'Customer', 'Blank', 'EQP', 'List'));