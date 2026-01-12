/*
  # Create Automations Engine Tables

  1. New Tables
    - `automations`
      - `id` (uuid, primary key)
      - `name` (text) - Automation name
      - `description` (text) - Optional description
      - `trigger_type` (text) - Trigger type (invoice_created, status_changed, etc.)
      - `trigger_config` (jsonb) - Trigger configuration
      - `conditions` (jsonb) - Array of conditions with AND/OR logic
      - `actions` (jsonb) - Array of actions to execute
      - `scheduling` (jsonb) - Scheduling configuration (immediate, delayed, scheduled)
      - `is_enabled` (boolean) - Whether automation is active
      - `created_by` (uuid) - User who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `automation_logs`
      - `id` (uuid, primary key)
      - `automation_id` (uuid) - Reference to automation
      - `trigger_event` (jsonb) - Event data that triggered automation
      - `executed_actions` (jsonb) - Actions that were executed
      - `status` (text) - success, failure, partial
      - `error_message` (text) - Error details if failed
      - `executed_at` (timestamptz)
      - `execution_time_ms` (integer) - How long it took to execute

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Indexes
    - Index on automation status and enabled flag
    - Index on automation_logs for filtering by automation_id and status
*/

-- Automations table
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  scheduling jsonb DEFAULT '{"type": "immediate"}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Automation logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event jsonb DEFAULT '{}'::jsonb,
  executed_actions jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'success',
  error_message text,
  executed_at timestamptz DEFAULT now(),
  execution_time_ms integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Automations policies
CREATE POLICY "Users can view all automations"
  ON automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete automations"
  ON automations FOR DELETE
  TO authenticated
  USING (true);

-- Automation logs policies
CREATE POLICY "Users can view all automation logs"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automation logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_automations_updated_at 
  BEFORE UPDATE ON automations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();