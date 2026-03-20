/*
  # Fix Automations Table Schema and RLS

  1. Changes
    - Drop old automations-related tables
    - Create new automations table with proper schema matching application needs
    - Add company_id for multi-tenancy
    - Add proper RLS policies for company isolation
    - Add indexes for performance

  2. Security
    - Enable RLS on automations table
    - Add policies for company-based access control
    - Ensure users can only access automations within their company
*/

-- Drop old tables if they exist
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS automation_actions CASCADE;
DROP TABLE IF EXISTS automation_triggers CASCADE;
DROP TABLE IF EXISTS automations CASCADE;

-- Create new automations table with proper schema
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}',
  conditions jsonb DEFAULT '[]',
  actions jsonb DEFAULT '[]',
  scheduling jsonb DEFAULT '{"type": "immediate"}',
  is_enabled boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event jsonb DEFAULT '{}',
  executed_actions jsonb DEFAULT '[]',
  status text NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
  error_message text,
  executed_at timestamptz DEFAULT now(),
  execution_time_ms integer
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_created_by ON automations(created_by);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_is_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_logs_company_id ON automation_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view automations in their company" ON automations;
  DROP POLICY IF EXISTS "Users can create automations in their company" ON automations;
  DROP POLICY IF EXISTS "Users can update automations in their company" ON automations;
  DROP POLICY IF EXISTS "Users can delete automations in their company" ON automations;
  DROP POLICY IF EXISTS "Users can view logs in their company" ON automation_logs;
  DROP POLICY IF EXISTS "System can insert automation logs" ON automation_logs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- RLS Policies for automations
CREATE POLICY "Users can view automations in their company"
  ON automations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create automations in their company"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update automations in their company"
  ON automations FOR UPDATE
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

CREATE POLICY "Users can delete automations in their company"
  ON automations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for automation_logs
CREATE POLICY "Users can view logs in their company"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert automation logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );