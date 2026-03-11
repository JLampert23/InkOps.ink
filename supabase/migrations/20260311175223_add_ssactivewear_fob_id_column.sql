/*
  # Add SSActivewear FOB ID Column

  1. Changes
    - Add `ssactivewear_fob_id` column to `company_settings` table
    - This column stores the FOB (Freight on Board) location ID for SSActivewear pricing
    - Column is nullable as it's an optional configuration setting

  2. Notes
    - FOB ID is used to determine shipping costs and warehouse locations for SSActivewear orders
    - This column was referenced in Edge Functions but was missing from the schema
*/

-- Add the missing column
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS ssactivewear_fob_id text;

COMMENT ON COLUMN company_settings.ssactivewear_fob_id IS 'FOB (Freight on Board) location ID for SSActivewear pricing and shipping calculations';
