/*
  # Create system_settings table

  1. New Tables
    - `system_settings`
      - `id` (uuid, primary key) - unique row identifier
      - `company_id` (uuid, foreign key to companies) - tenant isolation
      - `namespace` (text) - logical grouping key, e.g. "chipply"
      - `key` (text) - individual setting name within namespace
      - `value` (jsonb) - flexible JSON value for the setting
      - `created_at` (timestamptz) - row creation timestamp
      - `updated_at` (timestamptz) - last-modified timestamp

  2. Indexes
    - Unique constraint on (company_id, namespace, key) to prevent duplicates
    - Index on (company_id, namespace) for fast namespace lookups

  3. Security
    - Enable RLS on `system_settings` table
    - Super-admin-only read policy (requires super_admin role via user_profiles)
    - Super-admin-only insert policy
    - Super-admin-only update policy
    - Super-admin-only delete policy
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  namespace text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '""'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_unique_ns_key UNIQUE (company_id, namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_company_ns
  ON system_settings (company_id, namespace);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.company_id = system_settings.company_id
        AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert system settings"
  ON system_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.company_id = system_settings.company_id
        AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update system settings"
  ON system_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.company_id = system_settings.company_id
        AND user_profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.company_id = system_settings.company_id
        AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete system settings"
  ON system_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.company_id = system_settings.company_id
        AND user_profiles.role = 'super_admin'
    )
  );

CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_timestamp();
