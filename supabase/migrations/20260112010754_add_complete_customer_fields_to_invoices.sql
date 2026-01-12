/*
  # Add Complete Customer Fields to Invoices

  ## Changes
  
  This migration ensures that the printavo_invoices table contains all necessary
  customer fields to display complete invoice information without relying on the
  customer table.

  ## Fields Added/Verified
  
  1. Customer contact fields:
     - customer_phone (already exists)
     - customer_email (already exists)
     - customer_name (already exists)
     - customer_company (already exists)
  
  2. Address fields (JSONB format):
     - billing_address: {line1, line2, city, state, zip, country}
     - shipping_address: {line1, line2, city, state, zip, country}
  
  ## Notes
  
  - All fields are nullable to accommodate incomplete data from Printavo
  - JSONB format allows flexible address storage
  - Future syncs will populate these fields from Printavo customer data
*/

-- Ensure customer_phone exists (should already exist based on previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- Ensure billing_address exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address jsonb;
  END IF;
END $$;

-- Ensure shipping_address exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address jsonb;
  END IF;
END $$;

-- Add index for faster customer field queries
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_phone 
ON printavo_invoices(customer_phone);

-- Add index for customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id 
ON printavo_invoices(customer_id);

-- Add comment to document the structure
COMMENT ON COLUMN printavo_invoices.billing_address IS 
'Customer billing address in JSON format: {line1, line2, city, state, zip, country}';

COMMENT ON COLUMN printavo_invoices.shipping_address IS 
'Customer shipping address in JSON format: {line1, line2, city, state, zip, country}';
