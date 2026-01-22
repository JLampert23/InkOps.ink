/*
  # Create customer_payment_methods table

  1. New Tables
    - customer_payment_methods table for storing customer payment information
    
  2. Security
    - Enable RLS
    - Add policies for same-company access
*/

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  payment_method_type text NOT NULL CHECK (payment_method_type IN ('credit_card', 'bank_account', 'check', 'other')),
  name text NOT NULL,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  payment_processor text,
  processor_token text,
  last_four text,
  expiry_month integer CHECK (expiry_month >= 1 AND expiry_month <= 12),
  expiry_year integer CHECK (expiry_year >= 2000),
  bank_name text,
  account_type text CHECK (account_type IN ('checking', 'savings', NULL)),
  billing_address jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id ON customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_company_id ON customer_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_is_primary ON customer_payment_methods(is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view payment methods in their company"
  ON customer_payment_methods FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert payment methods in their company"
  ON customer_payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update payment methods in their company"
  ON customer_payment_methods FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete payment methods in their company"
  ON customer_payment_methods FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );