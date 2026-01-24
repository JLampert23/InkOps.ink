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
