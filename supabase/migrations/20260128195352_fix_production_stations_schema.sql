/*
  # Fix production_stations Schema

  1. Changes
    - Clear existing production_stations data with invalid foreign keys
    - Drop the foreign key to types_of_work
    - Rename column from type_of_work_id to work_type_id
    - Add foreign key to type_of_work_settings
    - Add company_id for proper multi-tenant isolation

  2. Purpose
    - Fix 400 error when querying production_stations
    - Align with correct table structure
*/

-- Clear existing data with invalid foreign keys
TRUNCATE TABLE production_stations CASCADE;

-- Drop the old foreign key constraint
ALTER TABLE production_stations 
DROP CONSTRAINT IF EXISTS production_stations_type_of_work_id_fkey;

-- Rename the column
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production_stations' 
    AND column_name = 'type_of_work_id'
  ) THEN
    ALTER TABLE production_stations 
    RENAME COLUMN type_of_work_id TO work_type_id;
  END IF;
END $$;

-- Add company_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production_stations' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE production_stations 
    ADD COLUMN company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add the correct foreign key to type_of_work_settings
ALTER TABLE production_stations
ADD CONSTRAINT production_stations_work_type_id_fkey 
FOREIGN KEY (work_type_id) 
REFERENCES type_of_work_settings(id) 
ON DELETE CASCADE;

-- Add index for the foreign key
CREATE INDEX IF NOT EXISTS idx_production_stations_work_type_id 
ON production_stations(work_type_id);

CREATE INDEX IF NOT EXISTS idx_production_stations_company_id 
ON production_stations(company_id);

-- Update RLS policies to use company_id
DROP POLICY IF EXISTS "Users can view production stations" ON production_stations;
DROP POLICY IF EXISTS "Users can insert production stations" ON production_stations;
DROP POLICY IF EXISTS "Users can update production stations" ON production_stations;
DROP POLICY IF EXISTS "Users can delete production stations" ON production_stations;

CREATE POLICY "Users can view production stations in their company"
  ON production_stations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert production stations in their company"
  ON production_stations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update production stations in their company"
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

CREATE POLICY "Users can delete production stations in their company"
  ON production_stations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );