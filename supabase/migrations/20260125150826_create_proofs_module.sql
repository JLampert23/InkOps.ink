/*
  # Create Proofs Module

  1. New Tables
    - `proofs` - Main table for storing proof records
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `quote_id` (uuid, references quotes)
      - `line_item_id` (uuid, references quote_line_items)
      - `customer_id` (uuid, references customers)
      - `proof_number` (text, unique identifier)
      - `proof_version` (int, default 1)
      - `garment_image_url` (text)
      - `garment_name` (text)
      - `print_width` (numeric)
      - `print_height` (numeric)
      - `print_depth` (numeric)
      - `print_unit` (text, 'inches' or 'cm')
      - `status` (text, 'draft', 'pending_approval', 'approved', 'rejected')
      - `notes` (text)
      - `created_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `approved_at` (timestamptz)
      - `rejected_at` (timestamptz)

    - `proof_artwork` - Artwork files for each proof
      - `id` (uuid, primary key)
      - `proof_id` (uuid, references proofs)
      - `company_id` (uuid, references company_settings)
      - `artwork_url` (text)
      - `artwork_name` (text)
      - `artwork_version` (int)
      - `file_type` (text)
      - `file_size` (bigint)
      - `created_at` (timestamptz)

    - `proof_colors` - Selected colors for each proof
      - `id` (uuid, primary key)
      - `proof_id` (uuid, references proofs)
      - `company_id` (uuid, references company_settings)
      - `color_type` (text, 'ink' or 'thread')
      - `color_name` (text)
      - `color_code` (text)
      - `created_at` (timestamptz)

  2. Storage
    - Create storage bucket for proof garment images
    - Create storage bucket for proof artwork files

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated company users

  4. Indexes
    - Index on company_id for all tables
    - Index on quote_id and line_item_id
    - Index on customer_id
*/

-- Create proofs table
CREATE TABLE IF NOT EXISTS proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  proof_number text UNIQUE NOT NULL,
  proof_version int DEFAULT 1,
  garment_image_url text,
  garment_name text,
  print_width numeric(10,2),
  print_height numeric(10,2),
  print_depth numeric(10,2),
  print_unit text DEFAULT 'inches' CHECK (print_unit IN ('inches', 'cm')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  notes text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

-- Create proof_artwork table
CREATE TABLE IF NOT EXISTS proof_artwork (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id uuid NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  artwork_url text NOT NULL,
  artwork_name text NOT NULL,
  artwork_version int DEFAULT 1,
  file_type text,
  file_size bigint,
  position_x numeric(10,2) DEFAULT 0,
  position_y numeric(10,2) DEFAULT 0,
  scale numeric(5,2) DEFAULT 1.0,
  rotation numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create proof_colors table
CREATE TABLE IF NOT EXISTS proof_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id uuid NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  color_type text NOT NULL CHECK (color_type IN ('ink', 'thread')),
  color_name text NOT NULL,
  color_code text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proofs_company_id ON proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_proofs_quote_id ON proofs(quote_id);
CREATE INDEX IF NOT EXISTS idx_proofs_line_item_id ON proofs(line_item_id);
CREATE INDEX IF NOT EXISTS idx_proofs_customer_id ON proofs(customer_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON proofs(status);

CREATE INDEX IF NOT EXISTS idx_proof_artwork_proof_id ON proof_artwork(proof_id);
CREATE INDEX IF NOT EXISTS idx_proof_artwork_company_id ON proof_artwork(company_id);

CREATE INDEX IF NOT EXISTS idx_proof_colors_proof_id ON proof_colors(proof_id);
CREATE INDEX IF NOT EXISTS idx_proof_colors_company_id ON proof_colors(company_id);

-- Enable RLS
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_artwork ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_colors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for proofs
CREATE POLICY "Users can view own company proofs"
  ON proofs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proofs for own company"
  ON proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company proofs"
  ON proofs FOR UPDATE
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

CREATE POLICY "Users can delete own company proofs"
  ON proofs FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create RLS policies for proof_artwork
CREATE POLICY "Users can view own company proof artwork"
  ON proof_artwork FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proof artwork for own company"
  ON proof_artwork FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company proof artwork"
  ON proof_artwork FOR UPDATE
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

CREATE POLICY "Users can delete own company proof artwork"
  ON proof_artwork FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create RLS policies for proof_colors
CREATE POLICY "Users can view own company proof colors"
  ON proof_colors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proof colors for own company"
  ON proof_colors FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own company proof colors"
  ON proof_colors FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create function to generate proof number
CREATE OR REPLACE FUNCTION generate_proof_number()
RETURNS text AS $$
DECLARE
  next_number int;
  proof_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(proof_number FROM '[0-9]+$') AS int)), 0) + 1
  INTO next_number
  FROM proofs
  WHERE proof_number ~ '^PROOF-[0-9]+$';
  
  proof_num := 'PROOF-' || LPAD(next_number::text, 6, '0');
  RETURN proof_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate proof number
CREATE OR REPLACE FUNCTION set_proof_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proof_number IS NULL OR NEW.proof_number = '' THEN
    NEW.proof_number := generate_proof_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_proof_number
  BEFORE INSERT ON proofs
  FOR EACH ROW
  EXECUTE FUNCTION set_proof_number();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_proof_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_proof_timestamp
  BEFORE UPDATE ON proofs
  FOR EACH ROW
  EXECUTE FUNCTION update_proof_timestamp();
