/*
  # Create Customer Contacts Table

  1. New Tables
    - `customer_contacts`
      - Contact identification (name, title, email, phone)
      - Relationship to customer
      - Primary contact flag
      - Audit fields

  2. Security
    - Enable RLS on customer_contacts table
    - Add policies for authenticated users to manage contacts

  3. Indexes
    - Index on customer_id for quick lookups
    - Index on email for searching
*/

-- Customer contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Contact Info
  full_name text NOT NULL,
  title text,
  email text,
  phone text,
  mobile text,
  
  -- Flags
  is_primary boolean DEFAULT false,
  
  -- Notes
  notes text,

  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Customer contacts policies
CREATE POLICY "Users can view all customer contacts"
  ON customer_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customer contacts"
  ON customer_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customer contacts"
  ON customer_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customer contacts"
  ON customer_contacts FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email ON customer_contacts(email);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_contacts_updated_at 
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
