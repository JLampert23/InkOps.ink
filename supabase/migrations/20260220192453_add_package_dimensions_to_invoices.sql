/*
  # Add Package Dimensions to Invoices

  1. Changes
    - Add `total_weight_oz` column to printavo_invoices
    - Add `package_length` column to printavo_invoices
    - Add `package_width` column to printavo_invoices
    - Add `package_height` column to printavo_invoices
    - Add `tracking_number` column to printavo_invoices

  2. Purpose
    - Store package dimensions for shipping label creation
    - Store weight for accurate shipping costs
    - Store tracking number from carrier

  3. Security
    - No RLS changes needed (inherits existing printavo_invoices policies)
*/

-- Add package dimensions columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'total_weight_oz'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN total_weight_oz decimal(10, 2) DEFAULT 16.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'package_length'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN package_length decimal(10, 2) DEFAULT 12.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'package_width'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN package_width decimal(10, 2) DEFAULT 9.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'package_height'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN package_height decimal(10, 2) DEFAULT 3.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN tracking_number text;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN printavo_invoices.total_weight_oz IS 'Total package weight in ounces (default: 16 oz / 1 lb)';
COMMENT ON COLUMN printavo_invoices.package_length IS 'Package length in inches (default: 12 in)';
COMMENT ON COLUMN printavo_invoices.package_width IS 'Package width in inches (default: 9 in)';
COMMENT ON COLUMN printavo_invoices.package_height IS 'Package height in inches (default: 3 in)';
COMMENT ON COLUMN printavo_invoices.tracking_number IS 'Carrier tracking number from shipping label';
