/*
  # Fix Company Settings RLS Policy

  1. Changes
    - Drop the overly permissive RLS policies on company_settings
    - Create strict policies that check company_id from user_profiles
    - Ensure users can only access their own company's settings

  2. Security
    - Users can only view settings for their company
    - Users can only update settings for their company
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can insert company settings" ON company_settings;

-- Create strict policies that check company_id
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert company settings on signup"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
  );