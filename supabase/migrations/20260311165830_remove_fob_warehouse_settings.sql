/*
  # Remove FOB Warehouse Configuration from Company Settings

  1. Changes
    - Drop `ssactivewear_fob_id` column from `company_settings` table
    - Drop `sanmar_fob_id` column from `company_settings` table
    - Drop related index for FOB warehouse lookups

  2. Reason
    - Switching to all-warehouse pricing model
    - Instead of querying a single FOB warehouse, we now query ALL warehouses
    - This provides better pricing visibility across all locations
    - Eliminates need for manual warehouse configuration

  3. Impact
    - Settings UI simplified (no warehouse dropdowns needed)
    - Backend will automatically query all available warehouses
    - Better pricing data for users (best price across all locations)

  4. Notes
    - Uses safe column drop with IF EXISTS checks
    - No data migration needed as these were configuration-only fields
*/

-- Drop the index first
DROP INDEX IF EXISTS idx_company_settings_fob_warehouses;

-- Drop SSActivewear FOB warehouse ID column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'ssactivewear_fob_id'
  ) THEN
    ALTER TABLE company_settings DROP COLUMN ssactivewear_fob_id;
  END IF;
END $$;

-- Drop SanMar FOB warehouse ID column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sanmar_fob_id'
  ) THEN
    ALTER TABLE company_settings DROP COLUMN sanmar_fob_id;
  END IF;
END $$;
