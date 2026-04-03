/*
  # Fix Execution Log to Use user_id Instead of company_id
  
  1. Changes
    - Drop old RLS policy first
    - Update automated_reports_execution_log to use user_id instead of company_id
    - Add user_id column to execution log
    - Update RLS policies to use user_id
    - Drop company_id column
  
  2. Security
    - Maintain RLS policies with user_id instead of company_id
*/

-- Drop old RLS policy first
DROP POLICY IF EXISTS "Users can view execution logs for their company" ON automated_reports_execution_log;

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automated_reports_execution_log' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE automated_reports_execution_log 
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop company_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automated_reports_execution_log' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE automated_reports_execution_log DROP COLUMN company_id CASCADE;
  END IF;
END $$;

-- Create new RLS policy
CREATE POLICY "Users can view their own execution logs"
  ON automated_reports_execution_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_execution_log_user ON automated_reports_execution_log(user_id);
