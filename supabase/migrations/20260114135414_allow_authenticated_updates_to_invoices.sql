/*
  # Allow authenticated users to update invoices and payments

  1. Changes
    - Add policy to allow authenticated users to update printavo_invoices
    - Add policy to allow authenticated users to insert printavo_payments
    - Required for manual payment marking functionality

  2. Security
    - Only authenticated users can perform these operations
    - Maintains data integrity while allowing necessary business operations
*/

-- Allow authenticated users to update invoices (for marking as paid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'printavo_invoices'
    AND policyname = 'Authenticated users can update invoices'
  ) THEN
    CREATE POLICY "Authenticated users can update invoices"
      ON printavo_invoices FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to insert payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'printavo_payments'
    AND policyname = 'Authenticated users can insert payments'
  ) THEN
    CREATE POLICY "Authenticated users can insert payments"
      ON printavo_payments FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
