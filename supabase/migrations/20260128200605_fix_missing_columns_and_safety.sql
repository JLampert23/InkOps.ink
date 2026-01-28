/*
  # Fix Missing Columns and Data Safety

  1. Changes
    - Add customer_id column to printavo_invoices table
    - Ensure customers.phone column exists (already should exist from original migration)
    - Add foreign key constraint for data integrity
    - Add indexes for performance

  2. Security
    - No changes to RLS policies (already configured)
*/

-- Add customer_id to printavo_invoices if it doesn't exist
ALTER TABLE printavo_invoices
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Add index for customer_id lookups
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id
ON printavo_invoices(customer_id);

-- Ensure customers.phone exists (should already exist but adding safety check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'phone'
  ) THEN
    ALTER TABLE customers ADD COLUMN phone text;
  END IF;
END $$;
