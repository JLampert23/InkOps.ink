/*
  # Fix Automation Logs - Add Execution Context

  1. Purpose
    - Improve automation logging to distinguish between async queue processing and direct execution
    - Remove confusing "partial" status messages
    - Add execution context to track how automations were triggered

  2. Changes
    - Add execution_method column to automation_logs (values: 'queued_async', 'direct', 'manual')
    - Add processing_note column for informational messages (not errors)
    - Update indexes for better query performance
*/

-- Add new columns to automation_logs
ALTER TABLE automation_logs 
ADD COLUMN IF NOT EXISTS execution_method text DEFAULT 'direct',
ADD COLUMN IF NOT EXISTS processing_note text;

-- Add check constraint for execution_method
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'automation_logs_execution_method_check'
  ) THEN
    ALTER TABLE automation_logs 
    ADD CONSTRAINT automation_logs_execution_method_check 
    CHECK (execution_method IN ('queued_async', 'direct', 'manual'));
  END IF;
END $$;

-- Add index for querying by execution method
CREATE INDEX IF NOT EXISTS idx_automation_logs_execution_method 
ON automation_logs(execution_method);

-- Add helpful comment
COMMENT ON COLUMN automation_logs.execution_method IS 'How the automation was triggered: queued_async (via queue processor), direct (real-time trigger), manual (user initiated)';
COMMENT ON COLUMN automation_logs.processing_note IS 'Informational notes about processing (not errors)';
