/*
  # Fix Automated Reports Execution Tracking
  
  1. New Table
    - `automated_reports_execution_log`
      - Tracks every cron run
      - Records which reports were evaluated
      - Stores detailed decision logic (why sent or why skipped)
      - Includes timing information for debugging
  
  2. Changes
    - Adds comprehensive execution tracking
    - Enables debugging and monitoring
    - Provides audit trail for automation runs
  
  3. Security
    - Enable RLS on execution log table
    - Grant read access to authenticated users in same company
*/

-- Create execution log table
CREATE TABLE IF NOT EXISTS automated_reports_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  report_id uuid REFERENCES automated_reports(id) ON DELETE CASCADE,
  executed_at timestamptz DEFAULT now(),
  
  -- Execution context
  scheduled_time_local time,
  scheduled_time_utc timestamptz,
  actual_execution_time_utc timestamptz,
  timezone text,
  
  -- Decision logic
  was_sent boolean DEFAULT false,
  skip_reason text,
  
  -- Timing checks
  within_time_window boolean,
  already_sent_today boolean,
  minutes_since_scheduled numeric,
  
  -- Result
  success boolean,
  error_message text,
  edge_function_request_id bigint,
  
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_execution_log_company ON automated_reports_execution_log(company_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_report ON automated_reports_execution_log(report_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_executed_at ON automated_reports_execution_log(executed_at DESC);

-- Enable RLS
ALTER TABLE automated_reports_execution_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read execution logs for their company
CREATE POLICY "Users can view execution logs for their company"
  ON automated_reports_execution_log FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Service role can insert logs
CREATE POLICY "Service role can insert execution logs"
  ON automated_reports_execution_log FOR INSERT
  TO service_role
  WITH CHECK (true);
