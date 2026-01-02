/*
  # Update Company Settings RLS for Shared Access
  
  1. Changes
    - Drop the restrictive read policy on company_settings
    - Create a new policy that allows all authenticated users to read any company_settings
    - Keep write policies restricted to the owner only
  
  2. Security
    - All authenticated users can read company settings (needed for team access)
    - Only the owner can insert/update their company settings
    - This allows team members to access shared company API credentials
*/

-- Drop the existing restrictive read policy
DROP POLICY IF EXISTS "Users can read own company settings" ON company_settings;

-- Create a new policy that allows all authenticated users to read company settings
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);
