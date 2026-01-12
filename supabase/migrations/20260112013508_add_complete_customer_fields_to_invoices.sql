/*
  # Add Complete Customer Fields to Invoices Table

  This migration adds comprehensive customer information fields to the invoices table
  to support full customer data display in invoice views and PDF exports.

  ## Changes

  1. **New Fields Added to printavo_invoices**
     - `customer_phone` - Phone number from customer's primary contact
     - `billing_address_line1` - First line of billing address
     - `billing_address_line2` - Second line of billing address
     - `billing_city` - Billing address city
     - `billing_state` - Billing address state/province
     - `billing_zip` - Billing address postal code
     - `billing_country` - Billing address country
     - `shipping_address_line1` - First line of shipping address
     - `shipping_address_line2` - Second line of shipping address
     - `shipping_city` - Shipping address city
     - `shipping_state` - Shipping address state/province
     - `shipping_zip` - Shipping address postal code
     - `shipping_country` - Shipping address country

  2. **Purpose**
     - Store complete customer snapshot at time of invoice creation
     - Enable full customer information display in invoice views
     - Support complete PDF invoice generation without additional queries
     - Maintain historical accuracy even if customer data changes later

  ## Notes
  - All fields are nullable to handle cases where data is not available
  - These fields store a snapshot of customer data at sync time
  - Invoice display should use these fields, not live customer table data
*/

-- Add phone field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- Add billing address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address_line1'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address_line1 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address_line2'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address_line2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_city'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_state'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_zip'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_zip text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_country'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_country text;
  END IF;
END $$;

-- Add shipping address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address_line1'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address_line1 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address_line2'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address_line2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_city'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_state'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_zip'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_zip text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_country'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_country text;
  END IF;
END $$;
