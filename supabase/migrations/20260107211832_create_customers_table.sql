/*
  # Create Customers Table

  1. New Tables
    - `customers`
      - Customer identification (name, company, email, phone)
      - Billing address information
      - Shipping address information
      - Customer preferences and notes
      - Audit fields (created_at, updated_at)

  2. Security
    - Enable RLS on customers table
    - Add policies for authenticated users to manage customers

  3. Indexes
    - Index on email for quick lookups
    - Index on company name for searching
    - Index on created_at for sorting
*/

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company/Contact Info
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,

  -- Billing Address
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text DEFAULT 'USA',

  -- Shipping Address
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text DEFAULT 'USA',

  -- Additional Info
  customer_type text DEFAULT 'business',
  tax_exempt boolean DEFAULT false,
  tax_id text,
  payment_terms text DEFAULT 'Net 30',
  credit_limit decimal(10,2),
  
  -- Notes
  notes text,
  internal_notes text,

  -- Status
  status text DEFAULT 'active',

  -- Audit fields
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Users can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add customer_id to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
