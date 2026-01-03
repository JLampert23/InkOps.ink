/*
  # Add Automated Reports Table

  1. New Tables
    - `automated_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `report_type` (text) - Type of report to generate
      - `report_name` (text) - Display name for the report
      - `schedule_type` (text) - daily, weekly, monthly, custom
      - `schedule_time` (time) - Time of day to send (HH:MM:SS)
      - `schedule_timezone` (text) - Timezone for scheduling (e.g., 'America/New_York')
      - `schedule_day_of_week` (integer) - For weekly schedules (0-6, Sunday=0)
      - `schedule_day_of_month` (integer) - For monthly schedules (1-31)
      - `email_recipients` (jsonb) - Array of email addresses
      - `file_formats` (jsonb) - Array of formats: ['pdf', 'csv']
      - `is_enabled` (boolean) - Whether the automation is active
      - `last_sent_at` (timestamptz) - Last time the report was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on `automated_reports` table
    - Add policies for users to manage their own automation rules
*/

CREATE TABLE IF NOT EXISTS automated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL,
  report_name text NOT NULL,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_time time NOT NULL DEFAULT '08:00:00',
  schedule_timezone text NOT NULL DEFAULT 'America/New_York',
  schedule_day_of_week integer CHECK (schedule_day_of_week >= 0 AND schedule_day_of_week <= 6),
  schedule_day_of_month integer CHECK (schedule_day_of_month >= 1 AND schedule_day_of_month <= 31),
  email_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_formats jsonb NOT NULL DEFAULT '["pdf"]'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation rules"
  ON automated_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules"
  ON automated_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON automated_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON automated_reports
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_automated_reports_user_id ON automated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_automated_reports_is_enabled ON automated_reports(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automated_reports_schedule_type ON automated_reports(schedule_type);