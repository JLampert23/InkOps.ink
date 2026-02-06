-- =============================================================================
-- FIX PAYMENTS TABLE SCHEMA TO MATCH APPLICATION CODE
-- =============================================================================
-- This migration ensures the payments table has all required columns
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing payments table schema...';

  -- Drop the payments table if it exists and recreate with correct schema
  DROP TABLE IF EXISTS payments CASCADE;

  CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL,
    customer_id uuid REFERENCES customers(id),
    amount NUMERIC NOT NULL CHECK (amount <> 0),
    payment_type TEXT,
    payment_method TEXT NOT NULL,
    check_number TEXT,
    notes TEXT,
    payment_date TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('printavo', 'stripe', 'manual')),
    source_payment_id TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reversed')),
    created_by uuid REFERENCES auth.users(id),
    recorded_by uuid REFERENCES auth.users(id),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Create indexes
  CREATE INDEX idx_payments_company_id ON payments(company_id);
  CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
  CREATE INDEX idx_payments_customer_id ON payments(customer_id);
  CREATE INDEX idx_payments_payment_date ON payments(payment_date);
  CREATE INDEX idx_payments_source ON payments(source);

  -- Enable RLS
  ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if any
  DROP POLICY IF EXISTS "Users can view payments from their company" ON payments;
  DROP POLICY IF EXISTS "Users can insert payments for their company" ON payments;
  DROP POLICY IF EXISTS "Users can update payments for their company" ON payments;
  DROP POLICY IF EXISTS "Finance users can delete payments for their company" ON payments;

  -- Create RLS policies
  CREATE POLICY "Users can view payments from their company" ON payments
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

  CREATE POLICY "Users can insert payments for their company" ON payments
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

  CREATE POLICY "Users can update payments for their company" ON payments
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

  CREATE POLICY "Finance users can delete payments for their company" ON payments
    FOR DELETE TO authenticated
    USING (
      company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
      AND
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'finance')
      )
    );

  RAISE NOTICE 'Payments table schema fixed successfully!';
END $$;
