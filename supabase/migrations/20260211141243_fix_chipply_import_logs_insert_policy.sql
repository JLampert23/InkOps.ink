/*
  # Add INSERT policy for chipply_import_logs
  
  1. Changes
    - Add INSERT policy to allow service role and admins to insert logs
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role can insert import logs" ON chipply_import_logs;

-- Allow service role to insert (this is bypassed anyway, but being explicit)
-- Allow admins to insert as well
CREATE POLICY "Service role can insert import logs"
  ON chipply_import_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = chipply_import_logs.company_id
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );
