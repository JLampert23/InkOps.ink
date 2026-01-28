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
