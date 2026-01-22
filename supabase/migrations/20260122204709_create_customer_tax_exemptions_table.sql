/*
  # Create customer_tax_exemptions table

  1. New Tables
    - customer_tax_exemptions table for tracking tax exemption certificates and history
    
  2. Security
    - Enable RLS
    - Add policies for same-company access
*/

CREATE TABLE IF NOT EXISTS customer_tax_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  exemption_type text NOT NULL CHECK (exemption_type IN ('federal', 'state', 'local', 'reseller', 'nonprofit', 'government', 'other')),
  tax_id text,
  exemption_number text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  document_url text,
  document_filename text,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_customer_id ON customer_tax_exemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_company_id ON customer_tax_exemptions(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_is_active ON customer_tax_exemptions(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE customer_tax_exemptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view tax exemptions in their company"
  ON customer_tax_exemptions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tax exemptions in their company"
  ON customer_tax_exemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update tax exemptions in their company"
  ON customer_tax_exemptions FOR UPDATE
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

CREATE POLICY "Users can delete tax exemptions in their company"
  ON customer_tax_exemptions FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );