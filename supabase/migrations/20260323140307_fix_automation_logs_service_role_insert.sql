/*
  # Fix Automation Logs RLS for Service Role Inserts
  
  1. Purpose
    - Allow the automation Edge Function to insert logs when using service role
    - The current policy checks auth.uid() which doesn't exist for service role calls
  
  2. Changes
    - Drop existing insert policy
    - Create new policy that allows service role to bypass the company check
    - Regular authenticated users still need to match company_id
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "System can insert automation logs" ON automation_logs;

-- Create new policy that works with service role
CREATE POLICY "System can insert automation logs"
  ON automation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if using service role (auth.uid() is NULL for service role)
    auth.uid() IS NULL
    OR
    -- Or if user's company matches
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

COMMENT ON POLICY "System can insert automation logs" ON automation_logs IS 
  'Allows service role to insert logs for automation processing, and allows users to insert logs for their own company';
