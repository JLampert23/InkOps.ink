/*
  # Customer Artwork Library

  1. New Tables
    - `customer_artwork`
      - Stores all artwork files uploaded for customers
      - Includes file metadata, dimensions, and tags
      - Associated with customer_id for reusable artwork library
  
  2. Changes to existing tables
    - Add fields to `proof_artwork` for print location and dimensions
    - Add artwork_id reference (nullable for backwards compatibility)
  
  3. Security
    - Enable RLS on customer_artwork table
    - Policies restrict access to company_id
*/

-- Create customer_artwork table
CREATE TABLE IF NOT EXISTS customer_artwork (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  width_inches numeric,
  height_inches numeric,
  tags text[] DEFAULT '{}',
  notes text,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add new columns to proof_artwork if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'customer_artwork_id'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN customer_artwork_id uuid REFERENCES customer_artwork(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'print_location'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN print_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'width_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN width_inches numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'height_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN height_inches numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN sort_order int DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_artwork_customer_id ON customer_artwork(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_artwork_company_id ON customer_artwork(company_id);
CREATE INDEX IF NOT EXISTS idx_proof_artwork_customer_artwork_id ON proof_artwork(customer_artwork_id);

-- Enable RLS on customer_artwork
ALTER TABLE customer_artwork ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_artwork
CREATE POLICY "Users can view their company's customer artwork"
  ON customer_artwork FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert customer artwork for their company"
  ON customer_artwork FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's customer artwork"
  ON customer_artwork FOR UPDATE
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

CREATE POLICY "Users can delete their company's customer artwork"
  ON customer_artwork FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );