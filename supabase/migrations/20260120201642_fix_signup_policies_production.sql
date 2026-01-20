/*
  # Fix Signup and User Profile Policies

  1. Changes
    - Remove duplicate RLS policies on user_profiles
    - Ensure clean, working policies for new user signup
    - Fix company_settings policies for signup flow
  
  2. Security
    - Maintains proper RLS isolation
    - Allows new users to create their profile during signup trigger
*/

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;

-- Drop all existing policies on company_settings
DROP POLICY IF EXISTS "Users can read their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "New users can insert company settings" ON company_settings;

-- Create clean policies for user_profiles
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

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role can manage all user profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create clean policies for company_settings
CREATE POLICY "Users can read their company settings"
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

CREATE POLICY "Service role can manage all company settings"
  ON company_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);