/*
  # Create Invoice Fees Table

  1. New Tables
    - `invoice_fees`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `fee_name` (text) - Name of the fee
      - `description` (text) - Optional description
      - `amount` (numeric) - Fee amount
      - `amount_type` (text) - Either 'dollar' or 'percent'
      - `is_taxed` (boolean) - Whether this fee is taxable
      - `show_by_default` (boolean) - Auto-populate on new quotes/invoices
      - `is_active` (boolean) - Whether fee is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `invoice_fees` table
    - Add policies for company-isolated access
    - Only authenticated users from the same company can manage fees

  3. Indexes
    - Index on company_id for fast lookups
    - Index on show_by_default for auto-population queries
*/

-- Create invoice_fees table
CREATE TABLE IF NOT EXISTS invoice_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  fee_name text NOT NULL,
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  amount_type text NOT NULL DEFAULT 'dollar' CHECK (amount_type IN ('dollar', 'percent')),
  is_taxed boolean NOT NULL DEFAULT false,
  show_by_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_fees_company_id ON invoice_fees(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_fees_show_by_default ON invoice_fees(company_id, show_by_default) WHERE is_active = true;

-- Enable RLS
ALTER TABLE invoice_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoice fees from their company"
  ON invoice_fees FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoice fees for their company"
  ON invoice_fees FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoice fees from their company"
  ON invoice_fees FOR UPDATE
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

CREATE POLICY "Users can delete invoice fees from their company"
  ON invoice_fees FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_invoice_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_fees_updated_at
  BEFORE UPDATE ON invoice_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_fees_updated_at();