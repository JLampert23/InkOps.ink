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
  EXECUTE FUNCTION update_updated_at_column();