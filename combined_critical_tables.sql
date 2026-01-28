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
  EXECUTE FUNCTION update_invoice_fees_updated_at();/*
  # Fix Invoice Fees Table Column Names

  1. Changes
    - Rename `name` column to `fee_name` to match application code
    - Update `amount_type` default from 'fixed' to 'dollar' to match application logic
    - Update CHECK constraint for amount_type to accept 'dollar' and 'percent'

  2. Rationale
    - Application code expects `fee_name` column
    - Application uses 'dollar' and 'percent' as amount_type values
*/

-- Rename name column to fee_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_fees' AND column_name = 'name'
  ) THEN
    ALTER TABLE invoice_fees RENAME COLUMN name TO fee_name;
  END IF;
END $$;

-- Drop old constraint and add new one for amount_type
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invoice_fees' AND constraint_name LIKE '%amount_type%'
  ) THEN
    ALTER TABLE invoice_fees DROP CONSTRAINT IF EXISTS invoice_fees_amount_type_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE invoice_fees ADD CONSTRAINT invoice_fees_amount_type_check 
    CHECK (amount_type IN ('dollar', 'percent'));
END $$;

-- Update default value for amount_type
ALTER TABLE invoice_fees ALTER COLUMN amount_type SET DEFAULT 'dollar';

-- Update any existing rows with 'fixed' to 'dollar'
UPDATE invoice_fees SET amount_type = 'dollar' WHERE amount_type = 'fixed';
/*
  # Create Price Matrices Table

  1. New Tables
    - `price_matrices`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `name` (text) - Name of the pricing matrix
      - `description` (text) - Optional description
      - `columns` (jsonb) - Array of column headers
      - `rows` (jsonb) - Array of row headers
      - `cells` (jsonb) - Object mapping row-column to price values
      - `is_active` (boolean) - Whether this matrix is currently active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `price_matrices` table
    - Add policies for authenticated users to manage their company's matrices

  3. Notes
    - Columns will be stored as: ["Size S", "Size M", "Size L", ...]
    - Rows will be stored as: ["1-24 units", "25-49 units", "50-99 units", ...]
    - Cells will be stored as: {"0-0": 10.50, "0-1": 9.50, "1-0": 9.00, ...}
      where the key is "rowIndex-columnIndex" and value is the price
*/

CREATE TABLE IF NOT EXISTS price_matrices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  columns jsonb DEFAULT '[]'::jsonb,
  rows jsonb DEFAULT '[]'::jsonb,
  cells jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_matrices_company_id ON price_matrices(company_id);
CREATE INDEX IF NOT EXISTS idx_price_matrices_is_active ON price_matrices(company_id, is_active);

ALTER TABLE price_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's price matrices"
  ON price_matrices
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's price matrices"
  ON price_matrices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's price matrices"
  ON price_matrices
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's price matrices"
  ON price_matrices
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_price_matrices_updated_at
  BEFORE UPDATE ON price_matrices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();/*
  # Create Imprints and Proofs Tables

  1. New Tables
    - `imprints`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `quote_line_item_id` (uuid, foreign key to quote_line_items) - optional
      - `location` (text) - Where the imprint goes (e.g., "Front", "Back", "Left Chest")
      - `ink_colors` (jsonb) - Array of ink color names
      - `print_passes` (integer) - Number of print passes
      - `production_notes` (text) - Notes for production
      - `selected_matrix_id` (uuid, foreign key to price_matrices) - Selected pricing matrix
      - `quantity` (integer) - Quantity for pricing calculation
      - `calculated_price` (decimal) - Auto-calculated price from matrix
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `imprint_proofs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `imprint_id` (uuid, foreign key to imprints)
      - `version_number` (integer) - Version number for ordering
      - `artwork_url` (text) - URL to uploaded artwork
      - `notes` (text) - Notes for this version
      - `status` (text) - e.g., "draft", "pending_approval", "approved", "rejected"
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their company's data

  3. Notes
    - Imprints can be attached to quote line items or standalone
    - Each imprint can have multiple proof versions
    - Pricing is auto-calculated based on selected matrix and quantity
*/

CREATE TABLE IF NOT EXISTS imprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  quote_line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT '',
  ink_colors jsonb DEFAULT '[]'::jsonb,
  print_passes integer DEFAULT 1,
  production_notes text DEFAULT '',
  selected_matrix_id uuid REFERENCES price_matrices(id) ON DELETE SET NULL,
  quantity integer DEFAULT 0,
  calculated_price decimal(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imprints_company_id ON imprints(company_id);
CREATE INDEX IF NOT EXISTS idx_imprints_quote_line_item_id ON imprints(quote_line_item_id);
CREATE INDEX IF NOT EXISTS idx_imprints_matrix_id ON imprints(selected_matrix_id);

CREATE TABLE IF NOT EXISTS imprint_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  imprint_id uuid REFERENCES imprints(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  artwork_url text NOT NULL,
  notes text DEFAULT '',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imprint_proofs_company_id ON imprint_proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_imprint_proofs_imprint_id ON imprint_proofs(imprint_id);
CREATE INDEX IF NOT EXISTS idx_imprint_proofs_version ON imprint_proofs(imprint_id, version_number);

ALTER TABLE imprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE imprint_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's imprints"
  ON imprints
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's imprints"
  ON imprints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's imprints"
  ON imprints
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's imprints"
  ON imprints
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their company's imprint proofs"
  ON imprint_proofs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's imprint proofs"
  ON imprint_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's imprint proofs"
  ON imprint_proofs
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's imprint proofs"
  ON imprint_proofs
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_imprints_updated_at
  BEFORE UPDATE ON imprints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_imprint_proofs_updated_at
  BEFORE UPDATE ON imprint_proofs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Add Type and Setup Fees to Price Matrices

  1. Changes
    - Add `matrix_type` field to categorize matrices (screen print, embroidery, DTG, etc.)
    - Add `setup_fee` field for one-time setup costs
    - Add `color_count_adjustments` jsonb field for price adjustments based on color count
    - Keep existing columns/rows/cells structure for flexible tier pricing

  2. Notes
    - matrix_type helps organize different printing methods
    - setup_fee can be applied once per order
    - color_count_adjustments allows pricing like: +$1 for each additional color
    - Existing structure supports quantity tiers via rows (e.g., 1-24, 25-49, 50-99)
      and size/variant tiers via columns (e.g., S, M, L, XL, 2XL)
*/

ALTER TABLE price_matrices
  ADD COLUMN IF NOT EXISTS matrix_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS setup_fee numeric(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS color_count_adjustments jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_price_matrices_type ON price_matrices(company_id, matrix_type);

COMMENT ON COLUMN price_matrices.matrix_type IS 'Type of pricing: screen_print, embroidery, dtg, vinyl, sublimation, general, etc.';
COMMENT ON COLUMN price_matrices.setup_fee IS 'One-time setup fee for this pricing method';
COMMENT ON COLUMN price_matrices.color_count_adjustments IS 'Price adjustments per color count, e.g., {"1": 0, "2": 1.5, "3": 2.5}';
/*
  # Create Customer Locations Table

  1. New Tables
    - `customer_locations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `location_name` (text) - Name of the location (e.g., "Downtown Store", "Warehouse A")
      - `address` (text) - Full address
      - `is_active` (boolean) - Whether this location is currently active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `customer_locations` table
    - Add policies for authenticated users to manage their company's locations
*/

CREATE TABLE IF NOT EXISTS customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  location_name text NOT NULL,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_locations_company_id ON customer_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_locations_is_active ON customer_locations(company_id, is_active);

ALTER TABLE customer_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's locations"
  ON customer_locations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's locations"
  ON customer_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's locations"
  ON customer_locations
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's locations"
  ON customer_locations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_customer_locations_updated_at
  BEFORE UPDATE ON customer_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Rename customer_locations to decoration_locations

  1. Changes
    - Rename `customer_locations` table to `decoration_locations`
    - Rename `location_name` to `decoration_name`
    - Update description to reflect garment decoration locations (e.g., "Left Front", "Full Back")
  
  2. Security
    - Maintain all existing RLS policies with updated table name
*/

-- Rename the table
ALTER TABLE IF EXISTS customer_locations RENAME TO decoration_locations;

-- Rename the column
ALTER TABLE IF EXISTS decoration_locations RENAME COLUMN location_name TO decoration_name;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can insert their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can update their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can delete their company's locations" ON decoration_locations;

-- Create new policies with updated names
CREATE POLICY "Users can view their company's decoration locations"
  ON decoration_locations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's decoration locations"
  ON decoration_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's decoration locations"
  ON decoration_locations
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's decoration locations"
  ON decoration_locations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Rename indexes
DROP INDEX IF EXISTS idx_customer_locations_company_id;
DROP INDEX IF EXISTS idx_customer_locations_is_active;

CREATE INDEX IF NOT EXISTS idx_decoration_locations_company_id ON decoration_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_decoration_locations_is_active ON decoration_locations(company_id, is_active);

-- Rename the trigger
DROP TRIGGER IF EXISTS update_customer_locations_updated_at ON decoration_locations;

CREATE TRIGGER update_decoration_locations_updated_at
  BEFORE UPDATE ON decoration_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
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
/*
  # Create Production Colors Table

  1. Purpose
    - Centralized table for managing company-wide ink and thread colors
    - Used by both Production Settings (InkThreadColorsManager) and Proof Builder (ColorSelectionPanel)
    - Replaces the misuse of color_stitch_options for individual colors

  2. New Tables
    - `production_colors`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `name` (text) - Color name (e.g., "Black", "Navy Blue")
      - `color_code` (text) - Hex color code (e.g., "#000000")
      - `type_of_work` (text) - "screen_printing" or "embroidery"
      - `is_active` (boolean) - Whether this color is available
      - `sort_order` (integer) - For custom ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on `production_colors` table
    - Add policy for authenticated users to read their company's colors
    - Add policy for admins to manage colors

  4. Default Colors
    - Seed common ink and thread colors for all existing companies
*/

-- Create the production_colors table
CREATE TABLE IF NOT EXISTS production_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_code text NOT NULL DEFAULT '#000000',
  type_of_work text NOT NULL CHECK (type_of_work IN ('screen_printing', 'embroidery')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_production_colors_company_id ON production_colors(company_id);
CREATE INDEX IF NOT EXISTS idx_production_colors_type ON production_colors(type_of_work, is_active);

-- Enable RLS
ALTER TABLE production_colors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read colors from their company
CREATE POLICY "Users can read company production_colors"
  ON production_colors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert colors for their company
CREATE POLICY "Admins can insert production_colors"
  ON production_colors FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can update colors for their company
CREATE POLICY "Admins can update production_colors"
  ON production_colors FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can delete colors for their company
CREATE POLICY "Admins can delete production_colors"
  ON production_colors FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Insert default ink colors for all existing companies
INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
SELECT 
  cs.id as company_id,
  color_data.name,
  color_data.code,
  'screen_printing',
  color_data.sort_order
FROM company_settings cs
CROSS JOIN (
  VALUES 
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Navy', '#000080', 4),
    ('Royal Blue', '#4169E1', 5),
    ('Light Blue', '#ADD8E6', 6),
    ('Dark Green', '#006400', 7),
    ('Kelly Green', '#4CBB17', 8),
    ('Yellow', '#FFFF00', 9),
    ('Orange', '#FFA500', 10),
    ('Purple', '#800080', 11),
    ('Maroon', '#800000', 12),
    ('Gray', '#808080', 13)
) AS color_data(name, code, sort_order)
ON CONFLICT DO NOTHING;

-- Insert default thread colors for all existing companies
INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
SELECT 
  cs.id as company_id,
  color_data.name,
  color_data.code,
  'embroidery',
  color_data.sort_order
FROM company_settings cs
CROSS JOIN (
  VALUES 
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Navy', '#000080', 4),
    ('Royal Blue', '#4169E1', 5),
    ('Light Blue', '#ADD8E6', 6),
    ('Dark Green', '#006400', 7),
    ('Kelly Green', '#4CBB17', 8),
    ('Yellow', '#FFFF00', 9),
    ('Orange', '#FFA500', 10),
    ('Purple', '#800080', 11),
    ('Maroon', '#800000', 12),
    ('Gray', '#808080', 13)
) AS color_data(name, code, sort_order)
ON CONFLICT DO NOTHING;

-- Create trigger to auto-create default colors when a new company is created
CREATE OR REPLACE FUNCTION create_default_production_colors()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default ink colors
  INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
  VALUES 
    (NEW.id, 'Black', '#000000', 'screen_printing', 1),
    (NEW.id, 'White', '#FFFFFF', 'screen_printing', 2),
    (NEW.id, 'Red', '#FF0000', 'screen_printing', 3),
    (NEW.id, 'Navy', '#000080', 'screen_printing', 4),
    (NEW.id, 'Royal Blue', '#4169E1', 'screen_printing', 5),
    (NEW.id, 'Light Blue', '#ADD8E6', 'screen_printing', 6),
    (NEW.id, 'Dark Green', '#006400', 'screen_printing', 7),
    (NEW.id, 'Kelly Green', '#4CBB17', 'screen_printing', 8),
    (NEW.id, 'Yellow', '#FFFF00', 'screen_printing', 9),
    (NEW.id, 'Orange', '#FFA500', 'screen_printing', 10),
    (NEW.id, 'Purple', '#800080', 'screen_printing', 11),
    (NEW.id, 'Maroon', '#800000', 'screen_printing', 12),
    (NEW.id, 'Gray', '#808080', 'screen_printing', 13);
  
  -- Insert default thread colors
  INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
  VALUES 
    (NEW.id, 'Black', '#000000', 'embroidery', 1),
    (NEW.id, 'White', '#FFFFFF', 'embroidery', 2),
    (NEW.id, 'Red', '#FF0000', 'embroidery', 3),
    (NEW.id, 'Navy', '#000080', 'embroidery', 4),
    (NEW.id, 'Royal Blue', '#4169E1', 'embroidery', 5),
    (NEW.id, 'Light Blue', '#ADD8E6', 'embroidery', 6),
    (NEW.id, 'Dark Green', '#006400', 'embroidery', 7),
    (NEW.id, 'Kelly Green', '#4CBB17', 'embroidery', 8),
    (NEW.id, 'Yellow', '#FFFF00', 'embroidery', 9),
    (NEW.id, 'Orange', '#FFA500', 'embroidery', 10),
    (NEW.id, 'Purple', '#800080', 'embroidery', 11),
    (NEW.id, 'Maroon', '#800000', 'embroidery', 12),
    (NEW.id, 'Gray', '#808080', 'embroidery', 13);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_production_colors
  AFTER INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION create_default_production_colors();/*
  # Create Garment Supplier Integration Settings

  1. New Tables
    - `integration_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `sanmar_enabled` (boolean) - whether SanMar integration is active
      - `sanmar_credentials` (jsonb) - encrypted SanMar API credentials
      - `ssactivewear_enabled` (boolean) - whether SSActivewear integration is active
      - `ssactivewear_credentials` (jsonb) - encrypted SSActivewear API credentials
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `integration_settings` table
    - Add policies for company-scoped access
    - Only authenticated users in the same company can access their integration settings
    - Only admins can modify integration settings

  3. Notes
    - Credentials stored as JSONB for flexibility
    - Each company has one integration_settings record
    - Credentials should be encrypted before storage
*/

-- Create integration_settings table
CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  sanmar_enabled boolean DEFAULT false,
  sanmar_credentials jsonb DEFAULT '{}'::jsonb,
  ssactivewear_enabled boolean DEFAULT false,
  ssactivewear_credentials jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

-- Create index on company_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_integration_settings_company_id 
  ON integration_settings(company_id);

-- Enable RLS
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's integration settings
CREATE POLICY "Users can view own company integration settings"
  ON integration_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Only admins can insert integration settings
CREATE POLICY "Admins can insert integration settings"
  ON integration_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Only admins can update integration settings
CREATE POLICY "Admins can update integration settings"
  ON integration_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Only admins can delete integration settings
CREATE POLICY "Admins can delete integration settings"
  ON integration_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_integration_settings_timestamp ON integration_settings;
CREATE TRIGGER update_integration_settings_timestamp
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_settings_updated_at();/*
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
  );/*
  # Create Work Type Workflows Table

  1. New Tables
    - `work_type_workflows`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `work_type_id` (uuid, foreign key to type_of_work_settings)
      - `steps` (jsonb) - array of step objects with statuses
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `work_type_workflows` table
    - Add policies for authenticated users in same company

  3. Indexes
    - Index on work_type_id for fast lookups
    - Index on company_id for multi-tenant isolation

  4. Example steps JSON structure:
    [
      {
        "step_name": "Production",
        "statuses": [
          { "name": "Not Started", "color": "#CCCCCC" },
          { "name": "In Progress", "color": "#FFA500" },
          { "name": "Complete", "color": "#00CC66" }
        ]
      },
      {
        "step_name": "Shipping",
        "statuses": [
          { "name": "Packed", "color": "#3399FF" },
          { "name": "Shipped", "color": "#6666FF" }
        ]
      }
    ]
*/

CREATE TABLE IF NOT EXISTS work_type_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_type_id uuid NOT NULL REFERENCES type_of_work_settings(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_type_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_work_type_workflows_work_type_id ON work_type_workflows(work_type_id);
CREATE INDEX IF NOT EXISTS idx_work_type_workflows_company_id ON work_type_workflows(company_id);

-- Enable RLS
ALTER TABLE work_type_workflows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view workflows in their company
CREATE POLICY "Users can view workflows in their company"
  ON work_type_workflows
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert workflows in their company
CREATE POLICY "Users can insert workflows in their company"
  ON work_type_workflows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update workflows in their company
CREATE POLICY "Users can update workflows in their company"
  ON work_type_workflows
  FOR UPDATE
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

-- Policy: Users can delete workflows in their company
CREATE POLICY "Users can delete workflows in their company"
  ON work_type_workflows
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_type_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_work_type_workflows_updated_at
  BEFORE UPDATE ON work_type_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_work_type_workflows_updated_at();/*
  # Create Production Schedule Entries Table

  1. New Tables
    - `production_schedule_entries`
      - `id` (uuid, primary key) - Unique identifier
      - `company_id` (uuid) - Company isolation
      - `quote_id` (uuid) - Reference to original quote
      - `line_item_id` (uuid) - Reference to quote line item
      - `imprint_id` (uuid) - Reference to quote imprint
      - `type_of_work` (text) - Type of work (e.g., "Screen Printing", "Embroidery")
      - `imprint_number` (text) - Display number for the imprint
      - `artwork_thumb_url` (text) - URL to artwork thumbnail
      - `production_due_date` (date) - Scheduled production date
      - `station` (text) - Assigned production station
      - `quantity` (int) - Number of items for this decoration
      - `step_statuses` (jsonb) - Current status for each workflow step
      - `priority_order` (int) - Order within the same day/station
      - `customer_name` (text) - Cached customer name for filtering
      - `quote_number` (text) - Cached quote number for filtering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `production_schedule_entries` table
    - Add policies for company-isolated access
    - Production users can view and update their company's schedule
*/

CREATE TABLE IF NOT EXISTS production_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  imprint_id uuid REFERENCES quote_imprints(id) ON DELETE CASCADE,
  type_of_work text NOT NULL,
  imprint_number text,
  artwork_thumb_url text,
  production_due_date date NOT NULL,
  station text,
  quantity int NOT NULL DEFAULT 0,
  step_statuses jsonb DEFAULT '{}'::jsonb,
  priority_order int DEFAULT 0,
  customer_name text,
  quote_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_entries_company_id ON production_schedule_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_type_of_work ON production_schedule_entries(company_id, type_of_work);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_due_date ON production_schedule_entries(company_id, production_due_date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_station ON production_schedule_entries(company_id, station);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_quote_id ON production_schedule_entries(quote_id);

-- Enable RLS
ALTER TABLE production_schedule_entries ENABLE ROW LEVEL SECURITY;

-- Policy for viewing schedule entries
CREATE POLICY "Users can view their company schedule entries"
  ON production_schedule_entries
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for creating schedule entries
CREATE POLICY "Users can create schedule entries for their company"
  ON production_schedule_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for updating schedule entries
CREATE POLICY "Users can update their company schedule entries"
  ON production_schedule_entries
  FOR UPDATE
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

-- Policy for deleting schedule entries
CREATE POLICY "Users can delete their company schedule entries"
  ON production_schedule_entries
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_schedule_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedule_entry_timestamp
  BEFORE UPDATE ON production_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_entry_updated_at();