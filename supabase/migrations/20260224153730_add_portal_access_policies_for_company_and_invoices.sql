/*
  # Add Portal Access Policies

  1. Changes
    - Add RLS policies for company_settings to allow anon read access (for branding)
    - Add RLS policies for printavo_invoices to allow anon read access (for customer portal)

  2. Security
    - Read-only access for anonymous users
    - Required for customer portal to function
*/

-- Allow portal access to company_settings (for branding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'company_settings' 
    AND policyname = 'Portal can view company settings'
  ) THEN
    CREATE POLICY "Portal can view company settings"
      ON company_settings
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow portal access to printavo_invoices (for customer invoices)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'printavo_invoices' 
    AND policyname = 'Portal can view invoices'
  ) THEN
    CREATE POLICY "Portal can view invoices"
      ON printavo_invoices
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow portal access to payments table for payment history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' 
    AND policyname = 'Portal can view payments'
  ) THEN
    CREATE POLICY "Portal can view payments"
      ON payments
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow portal access to proofs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'proofs' 
    AND policyname = 'Portal can view proofs'
  ) THEN
    CREATE POLICY "Portal can view proofs"
      ON proofs
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow portal access to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quote_line_items' 
    AND policyname = 'Portal can view quote line items'
  ) THEN
    CREATE POLICY "Portal can view quote line items"
      ON quote_line_items
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;