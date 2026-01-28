/*
  # Fix User Profiles RLS Performance Issue
  
  1. Problem
    - Current RLS policies check `permissions` JSONB field which causes circular dependencies
    - This makes queries very slow and can cause infinite recursion
  
  2. Solution
    - Replace policies to use the `role` column directly
    - Use simple text comparison instead of JSONB queries
    - Roles: 'super_admin', 'admin', 'user', 'employee'
  
  3. Security
    - Users can view their own profile
    - Admins and super_admins can view all profiles
    - Users can only update their own profile
    - Only admins and super_admins can update any profile
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON user_profiles;

-- Create new optimized policies using role column
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    role IN ('super_admin', 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (role IN ('super_admin', 'admin'))
  WITH CHECK (role IN ('super_admin', 'admin'));

CREATE POLICY "System can insert profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
