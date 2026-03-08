/*
  # Add FOB Warehouse Configuration for Garment Suppliers

  1. Changes
    - Add `ssactivewear_fob_id` column to `company_settings` table
      - Default value: 'NJ' (Robbinsville, New Jersey)
      - Nullable to support backward compatibility
    - Add `sanmar_fob_id` column to `company_settings` table
      - Default value: '1' (SanMar primary distribution center)
      - Nullable to support backward compatibility

  2. Purpose
    - Allow each company to configure their preferred FOB warehouse per supplier
    - FOB warehouse affects wholesale pricing from PromoStandards APIs
    - Ensures accurate pricing based on shipping origin

  3. Notes
    - Uses safe column addition with IF NOT EXISTS checks
    - Existing companies will use default values until they configure
    - SSActivewear options: NJ, IL, KS, TX, GA, NV, DS
    - SanMar options: documented in SanMar PromoStandards specification
*/

-- Add SSActivewear FOB warehouse ID column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'ssactivewear_fob_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN ssactivewear_fob_id text DEFAULT 'NJ';
  END IF;
END $$;

-- Add SanMar FOB warehouse ID column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sanmar_fob_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sanmar_fob_id text DEFAULT '1';
  END IF;
END $$;

-- Create index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_company_settings_fob_warehouses 
  ON company_settings(ssactivewear_fob_id, sanmar_fob_id);