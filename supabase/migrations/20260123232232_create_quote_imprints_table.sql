/*
  # Create Quote Imprints Table

  1. New Tables
    - `quote_imprints`
      - `id` (uuid, primary key)
      - `quote_id` (uuid, foreign key to quotes)
      - `company_id` (uuid, foreign key to company_settings)
      - `matrix` (text) - Location of imprint (Front, Back, Left Chest, etc.)
      - `column_number` (text) - Column number for organization
      - `type_of_work` (text) - Type of decoration (Screen Print, Embroidery, etc.)
      - `details` (text) - Additional details about the imprint
      - `mockups` (jsonb) - Array of mockup image URLs
      - `sort_order` (integer) - Order of imprints
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `quote_imprints` table
    - Add policies for authenticated users to manage their company's imprints
*/

CREATE TABLE IF NOT EXISTS quote_imprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  matrix text,
  column_number text,
  type_of_work text,
  details text,
  mockups jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_imprints_quote_id ON quote_imprints(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_imprints_company_id ON quote_imprints(company_id);

ALTER TABLE quote_imprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's imprints"
  ON quote_imprints
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's imprints"
  ON quote_imprints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's imprints"
  ON quote_imprints
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
  ON quote_imprints
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_quote_imprint_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.quote_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM quotes
    WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_imprint_company_id_trigger
  BEFORE INSERT ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_imprint_company_id();

CREATE TRIGGER update_quote_imprints_updated_at
  BEFORE UPDATE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();