/*
  # Create Customer Fundraising Credits Table

  1. New Tables
    - `customer_fundraising_credits`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `company_id` (uuid, foreign key to company_settings)
      - `date` (date) - Date of fundraising payout
      - `store_name` (text) - Store name or number
      - `batch_number` (text) - Batch identifier
      - `amount` (numeric) - Fundraising amount earned
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `customer_fundraising_credits` table
    - Add policy for authenticated users to read credits in their company
    - Add policy for authenticated users to insert credits in their company
    - Add policy for authenticated users to update credits in their company
    - Add policy for authenticated users to delete credits in their company

  3. Indexes
    - Index on customer_id for fast lookups
    - Index on company_id for company isolation
*/

-- Create customer_fundraising_credits table
CREATE TABLE IF NOT EXISTS customer_fundraising_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  date date NOT NULL,
  store_name text NOT NULL,
  batch_number text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fundraising_credits_customer_id ON customer_fundraising_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_credits_company_id ON customer_fundraising_credits(company_id);

-- Enable RLS
ALTER TABLE customer_fundraising_credits ENABLE ROW LEVEL SECURITY;

-- Policy for selecting credits (users can view credits for customers in their company)
CREATE POLICY "Users can view fundraising credits in their company"
  ON customer_fundraising_credits FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for inserting credits (users can add credits for customers in their company)
CREATE POLICY "Users can insert fundraising credits in their company"
  ON customer_fundraising_credits FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for updating credits (users can update credits for customers in their company)
CREATE POLICY "Users can update fundraising credits in their company"
  ON customer_fundraising_credits FOR UPDATE
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

-- Policy for deleting credits (users can delete credits for customers in their company)
CREATE POLICY "Users can delete fundraising credits in their company"
  ON customer_fundraising_credits FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fundraising_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row updates
DROP TRIGGER IF EXISTS set_fundraising_credits_updated_at ON customer_fundraising_credits;
CREATE TRIGGER set_fundraising_credits_updated_at
  BEFORE UPDATE ON customer_fundraising_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_fundraising_credits_updated_at();
