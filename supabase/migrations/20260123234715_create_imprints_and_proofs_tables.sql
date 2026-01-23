/*
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
