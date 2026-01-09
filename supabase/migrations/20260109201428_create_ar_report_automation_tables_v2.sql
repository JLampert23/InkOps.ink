/*
  # Create AR Report Automation and Presets Tables

  1. New Tables
    - `ar_report_presets`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `name` (text) - preset name
      - `columns` (jsonb) - array of column names to include
      - `filters` (jsonb) - filter configuration
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `ar_report_automations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `name` (text) - automation name
      - `frequency` (text) - daily, weekly, monthly
      - `time_of_day` (time) - when to send
      - `day_of_week` (int) - for weekly (0-6, 0=Sunday)
      - `day_of_month` (int) - for monthly (1-31)
      - `recipients` (jsonb) - array of email addresses
      - `format` (text) - pdf or csv
      - `filters` (jsonb) - filter configuration
      - `columns` (jsonb) - array of column names to include
      - `enabled` (boolean)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `ar_report_logs`
      - `id` (uuid, primary key)
      - `automation_id` (uuid, references ar_report_automations)
      - `company_id` (uuid, references company_settings)
      - `executed_at` (timestamptz)
      - `format` (text)
      - `filters` (jsonb)
      - `recipients` (jsonb)
      - `success` (boolean)
      - `error_message` (text)
      - `invoice_count` (int)
      - `total_outstanding` (numeric)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their company's data
*/

-- AR Report Presets Table
CREATE TABLE IF NOT EXISTS ar_report_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ar_report_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's AR report presets"
  ON ar_report_presets FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create AR report presets for their company"
  ON ar_report_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's AR report presets"
  ON ar_report_presets FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company's AR report presets"
  ON ar_report_presets FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

-- AR Report Automations Table
CREATE TABLE IF NOT EXISTS ar_report_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  time_of_day time NOT NULL DEFAULT '09:00:00',
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 31),
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  format text NOT NULL CHECK (format IN ('pdf', 'csv')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ar_report_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's AR report automations"
  ON ar_report_automations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create AR report automations for their company"
  ON ar_report_automations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's AR report automations"
  ON ar_report_automations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company's AR report automations"
  ON ar_report_automations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

-- AR Report Logs Table
CREATE TABLE IF NOT EXISTS ar_report_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES ar_report_automations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  executed_at timestamptz DEFAULT now() NOT NULL,
  format text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  success boolean NOT NULL,
  error_message text,
  invoice_count int,
  total_outstanding numeric(10, 2)
);

ALTER TABLE ar_report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's AR report logs"
  ON ar_report_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ar_report_presets_company ON ar_report_presets(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_automations_company ON ar_report_automations(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_automations_enabled ON ar_report_automations(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_automation ON ar_report_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_company ON ar_report_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_executed_at ON ar_report_logs(executed_at DESC);