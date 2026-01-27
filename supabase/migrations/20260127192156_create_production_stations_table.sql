/*
  # Create Production Stations Table

  1. New Tables
    - `production_stations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `work_type_id` (uuid, references type_of_work_settings)
      - `station_name` (text, name of the station)
      - `is_active` (boolean, whether station is currently active)
      - `display_order` (integer, for sorting stations)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `production_stations` table
    - Add policies for authenticated users to manage stations within their company

  3. Purpose
    - Allows companies to define stations for each type of work
    - Stations can be assigned to production schedule entries
    - Supports multiple stations per work type for scheduling
*/

-- Create production_stations table
CREATE TABLE IF NOT EXISTS production_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_type_id uuid NOT NULL REFERENCES type_of_work_settings(id) ON DELETE CASCADE,
  station_name text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_stations_company_id ON production_stations(company_id);
CREATE INDEX IF NOT EXISTS idx_production_stations_work_type_id ON production_stations(work_type_id);
CREATE INDEX IF NOT EXISTS idx_production_stations_display_order ON production_stations(display_order);

-- Enable RLS
ALTER TABLE production_stations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view stations in their company"
  ON production_stations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert stations in their company"
  ON production_stations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update stations in their company"
  ON production_stations FOR UPDATE
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

CREATE POLICY "Users can delete stations in their company"
  ON production_stations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_production_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_stations_updated_at
  BEFORE UPDATE ON production_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_production_stations_updated_at();