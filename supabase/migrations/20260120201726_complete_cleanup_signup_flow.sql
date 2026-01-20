/*
  # Complete Cleanup of Signup Flow

  1. Changes
    - Remove ALL duplicate RLS policies
    - Create clean, minimal policies for signup to work
    - Ensure trigger can execute without RLS conflicts
  
  2. Security
    - Proper company isolation maintained
    - New users can sign up successfully
*/

-- ========================================
-- Clean up company_settings policies
-- ========================================
DROP POLICY IF EXISTS "Users can read their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
DROP POLICY IF EXISTS "Super admins can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "Allow company creation during signup" ON company_settings;
DROP POLICY IF EXISTS "Service role can manage all company settings" ON company_settings;

-- Create single, clear SELECT policy
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create single, clear UPDATE policy
CREATE POLICY "Users can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Service role has full access (needed for triggers)
CREATE POLICY "Service role has full access to company settings"
  ON company_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- Clean up user_profiles policies
-- ========================================
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Service role can manage all user profiles" ON user_profiles;

-- Users can view profiles in their company
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role has full access (needed for triggers)
CREATE POLICY "Service role has full access to user profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);