/*
  # Link Customers to Invoices

  ## Description
  This migration adds the infrastructure to link the `customers` table
  with the `printavo_invoices` table. Customers will be automatically
  created when invoices are synced from Printavo.

  ## Changes

  1. Schema Updates
    - Add `customer_id` foreign key to `printavo_invoices`
    - Add `printavo_customer_id` to `customers` to track Printavo ID
    - Add indexes for performance

  2. Data Integrity
    - Foreign key constraint to ensure data consistency
    - Nullable customer_id to support existing invoices

  ## Notes
  - Existing invoices will have NULL customer_id initially
  - Customer sync will populate these relationships automatically
  - Customers are matched by email first, then by name
*/

-- Add printavo_customer_id to customers table to track Printavo customer ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'printavo_customer_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN printavo_customer_id text;
  END IF;
END $$;

-- Add customer_id foreign key to printavo_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create index on printavo_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_printavo_id ON customers(printavo_customer_id);

-- Create index on customer_id in printavo_invoices for faster joins
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id ON printavo_invoices(customer_id);

-- Add customer_phone to printavo_invoices if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;