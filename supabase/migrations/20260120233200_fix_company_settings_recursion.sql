/*
  # Fix Company Settings RLS Policies

  1. Changes
    - Update company_settings policies to use the get_user_company_id() function
    - This prevents any potential recursion issues
    - Ensures consistent access pattern across tables

  2. Security
    - Users can view and update their company settings
    - Uses the security definer function to avoid recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view their company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

CREATE POLICY "Users can update their company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (id = get_user_company_id())
  WITH CHECK (id = get_user_company_id());
