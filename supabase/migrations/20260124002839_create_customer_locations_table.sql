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
