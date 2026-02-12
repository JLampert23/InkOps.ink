/*
  # Create Automations Module Tables

  1. New Tables
    - `automations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `is_active` (boolean, default true)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `automation_triggers`
      - `id` (uuid, primary key)
      - `automation_id` (uuid, foreign key to automations)
      - `trigger_type` (text)
      - `trigger_config` (jsonb)
      - `created_at` (timestamptz)
    
    - `automation_actions`
      - `id` (uuid, primary key)
      - `automation_id` (uuid, foreign key to automations)
      - `step_order` (integer)
      - `action_type` (text)
      - `action_config` (jsonb)
      - `created_at` (timestamptz)
    
    - `automation_logs`
      - `id` (uuid, primary key)
      - `automation_id` (uuid)
      - `step_order` (integer)
      - `action_type` (text)
      - `status` (text)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their automations
    - Add policies for viewing automation logs
*/

-- Create automations table
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create automation_triggers table
CREATE TABLE IF NOT EXISTS automation_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create automation_actions table
CREATE TABLE IF NOT EXISTS automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE NOT NULL,
  step_order integer NOT NULL,
  action_type text NOT NULL,
  action_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL,
  step_order integer,
  action_type text,
  status text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_automation_triggers_automation_id ON automation_triggers(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_automation_id ON automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automations_created_by ON automations(created_by);

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automations
CREATE POLICY "Users can view their own automations"
  ON automations FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create their own automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own automations"
  ON automations FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for automation_triggers
CREATE POLICY "Users can view triggers for their automations"
  ON automation_triggers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_triggers.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create triggers for their automations"
  ON automation_triggers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_triggers.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update triggers for their automations"
  ON automation_triggers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_triggers.automation_id
      AND automations.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_triggers.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete triggers for their automations"
  ON automation_triggers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_triggers.automation_id
      AND automations.created_by = auth.uid()
    )
  );

-- RLS Policies for automation_actions
CREATE POLICY "Users can view actions for their automations"
  ON automation_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_actions.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create actions for their automations"
  ON automation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_actions.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update actions for their automations"
  ON automation_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_actions.automation_id
      AND automations.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_actions.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete actions for their automations"
  ON automation_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_actions.automation_id
      AND automations.created_by = auth.uid()
    )
  );

-- RLS Policies for automation_logs
CREATE POLICY "Users can view logs for their automations"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations
      WHERE automations.id = automation_logs.automation_id
      AND automations.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert automation logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);