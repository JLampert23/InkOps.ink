/*
  # Create Template Validation Logs Table

  1. New Tables
    - `template_validation_logs`
      - `id` (uuid, primary key) - Unique log identifier
      - `company_id` (uuid, foreign key) - Links to companies table
      - `template_id` (uuid, foreign key) - Links to communication_templates table
      - `template_type` (text) - Type of template
      - `template_name` (text) - Name of template at time of validation
      - `action` (text) - Action performed (created, updated, sent, activated)
      - `validation_status` (text) - Status (passed, failed, warning, override)
      - `has_errors` (boolean) - Whether validation errors occurred
      - `has_missing_required_codes` (boolean) - Whether required codes were missing
      - `missing_codes` (jsonb) - Array of missing required codes with reasons
      - `errors` (jsonb) - Array of validation errors
      - `warnings` (jsonb) - Array of validation warnings
      - `override_used` (boolean) - Whether admin override was used
      - `user_id` (uuid) - User who performed the action
      - `user_role` (text) - Role of user at time of action
      - `created_at` (timestamp) - Log creation timestamp

  2. Security
    - Enable RLS on `template_validation_logs` table
    - Only admins can view logs
    - Logs are automatically created by system (INSERT policy for service role only)

  3. Indexes
    - Index on company_id for fast company filtering
    - Index on template_id for template history
    - Index on created_at for time-based queries
    - Index on validation_status for filtering

  4. Purpose
    - Audit trail for template validation
    - Track admin overrides
    - Monitor compliance with required short codes
    - Debug validation issues
*/

-- Create the template_validation_logs table
CREATE TABLE IF NOT EXISTS template_validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id uuid REFERENCES communication_templates(id) ON DELETE SET NULL,
  template_type text NOT NULL,
  template_name text NOT NULL,
  action text NOT NULL,
  validation_status text NOT NULL,
  has_errors boolean NOT NULL DEFAULT false,
  has_missing_required_codes boolean NOT NULL DEFAULT false,
  missing_codes jsonb DEFAULT '[]'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  override_used boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role text,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraint: only allow specific actions
  CONSTRAINT valid_action CHECK (
    action IN ('created', 'updated', 'activated', 'sent', 'validated')
  ),

  -- Constraint: only allow specific validation statuses
  CONSTRAINT valid_validation_status CHECK (
    validation_status IN ('passed', 'failed', 'warning', 'override')
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS template_validation_logs_company_id_idx
  ON template_validation_logs(company_id);

CREATE INDEX IF NOT EXISTS template_validation_logs_template_id_idx
  ON template_validation_logs(template_id);

CREATE INDEX IF NOT EXISTS template_validation_logs_created_at_idx
  ON template_validation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS template_validation_logs_status_idx
  ON template_validation_logs(validation_status);

CREATE INDEX IF NOT EXISTS template_validation_logs_override_idx
  ON template_validation_logs(company_id, override_used)
  WHERE override_used = true;

-- Enable Row Level Security
ALTER TABLE template_validation_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view validation logs for their company" ON template_validation_logs;
DROP POLICY IF EXISTS "Service role can insert validation logs" ON template_validation_logs;

-- Policy: Only admins and super admins can view logs
CREATE POLICY "Admins can view validation logs for their company"
  ON template_validation_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Service role can insert logs (for automated logging)
CREATE POLICY "Service role can insert validation logs"
  ON template_validation_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Authenticated users can insert their own logs
CREATE POLICY "Users can insert their own validation logs"
  ON template_validation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Create a function to log template validation events
CREATE OR REPLACE FUNCTION log_template_validation(
  p_company_id uuid,
  p_template_id uuid,
  p_template_type text,
  p_template_name text,
  p_action text,
  p_validation_status text,
  p_has_errors boolean,
  p_has_missing_required_codes boolean,
  p_missing_codes jsonb,
  p_errors jsonb,
  p_warnings jsonb,
  p_override_used boolean,
  p_user_id uuid,
  p_user_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO template_validation_logs (
    company_id,
    template_id,
    template_type,
    template_name,
    action,
    validation_status,
    has_errors,
    has_missing_required_codes,
    missing_codes,
    errors,
    warnings,
    override_used,
    user_id,
    user_role
  ) VALUES (
    p_company_id,
    p_template_id,
    p_template_type,
    p_template_name,
    p_action,
    p_validation_status,
    p_has_errors,
    p_has_missing_required_codes,
    p_missing_codes,
    p_errors,
    p_warnings,
    p_override_used,
    p_user_id,
    p_user_role
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- Add comment to the table
COMMENT ON TABLE template_validation_logs IS 'Audit log for email template validation events, including admin overrides and missing required short codes';

-- Add comment to the function
COMMENT ON FUNCTION log_template_validation IS 'Helper function to log template validation events from edge functions';
