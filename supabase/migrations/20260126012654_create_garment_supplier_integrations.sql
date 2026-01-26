/*
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
  EXECUTE FUNCTION update_integration_settings_updated_at();