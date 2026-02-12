/*
  # Add Scheduler Fields to Automations Table

  1. Changes to `automations` table
    - Add `company_id` (uuid, foreign key to companies)
    - Add `trigger_type` (text) - Type of trigger that starts the automation
    - Add `is_enabled` (boolean) - Replaces is_active for consistency with queue system
    - Add `conditions` (jsonb) - Conditions that must be met
    - Add `scheduling` (jsonb) - Scheduling configuration for time-based triggers
    - Add `actions` (jsonb) - Actions to execute (for compatibility)
    - Add `description` (text) - Optional description

  2. Indexes
    - Add index on company_id for performance
    - Add index on trigger_type for scheduler queries
    - Add index on is_enabled for active automation queries

  3. Security
    - Update RLS policies to use company_id
*/

-- Add missing columns to automations table
DO $$
BEGIN
  -- Add company_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE automations ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  -- Add trigger_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'trigger_type'
  ) THEN
    ALTER TABLE automations ADD COLUMN trigger_type text NOT NULL DEFAULT 'manual';
  END IF;

  -- Add is_enabled if it doesn't exist (separate from is_active)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'is_enabled'
  ) THEN
    ALTER TABLE automations ADD COLUMN is_enabled boolean DEFAULT true;
  END IF;

  -- Add conditions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'conditions'
  ) THEN
    ALTER TABLE automations ADD COLUMN conditions jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add scheduling if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'scheduling'
  ) THEN
    ALTER TABLE automations ADD COLUMN scheduling jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add actions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'actions'
  ) THEN
    ALTER TABLE automations ADD COLUMN actions jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add description if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automations' AND column_name = 'description'
  ) THEN
    ALTER TABLE automations ADD COLUMN description text;
  END IF;
END $$;

-- Add indexes for scheduler queries
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_is_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type_enabled ON automations(trigger_type, is_enabled) WHERE is_enabled = true;

-- Add index for scheduled automations (time-based triggers)
CREATE INDEX IF NOT EXISTS idx_automations_scheduled_triggers ON automations(trigger_type, is_enabled)
  WHERE trigger_type IN ('time_delay_trigger', 'scheduled_datetime_trigger', 'recurring_schedule_trigger')
  AND is_enabled = true;

-- Drop old RLS policies that reference created_by
DROP POLICY IF EXISTS "Users can view their own automations" ON automations;
DROP POLICY IF EXISTS "Users can create their own automations" ON automations;
DROP POLICY IF EXISTS "Users can update their own automations" ON automations;
DROP POLICY IF EXISTS "Users can delete their own automations" ON automations;

-- Create new RLS policies using company_id
CREATE POLICY "Users can view company automations"
  ON automations FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create company automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company automations"
  ON automations FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Add fields to automation_queue for paused automations
DO $$
BEGIN
  -- Add current_step for tracking progress through multi-step automations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_queue' AND column_name = 'current_step'
  ) THEN
    ALTER TABLE automation_queue ADD COLUMN current_step integer DEFAULT 0;
  END IF;

  -- Add pause_reason for tracking why automation is paused (e.g., 'wait_duration', 'wait_until')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_queue' AND column_name = 'pause_reason'
  ) THEN
    ALTER TABLE automation_queue ADD COLUMN pause_reason text;
  END IF;

  -- Add resume_after for wait actions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_queue' AND column_name = 'resume_after'
  ) THEN
    ALTER TABLE automation_queue ADD COLUMN resume_after timestamptz;
  END IF;
END $$;

-- Add index for paused automations that need to resume
CREATE INDEX IF NOT EXISTS idx_automation_queue_resume ON automation_queue(status, resume_after)
  WHERE status = 'pending' AND resume_after IS NOT NULL;