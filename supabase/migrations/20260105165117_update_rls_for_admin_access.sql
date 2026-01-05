/*
  # Update RLS Policies for Admin Access

  ## Changes
  
  ### Automated Reports Table
  - Update SELECT policy to allow admins to view all automation rules
  - Update INSERT policy to allow admins to create automation rules for any user
  - Update UPDATE policy to allow admins to update any automation rule
  - Update DELETE policy to allow admins to delete any automation rule
  
  ### User Profiles Table
  - Update UPDATE policy to allow admins to update any user profile
  - Add DELETE policy to allow admins to delete user profiles
  
  ## Security Notes
  - Regular users can still only manage their own automation rules
  - Admins (users with role='admin' in user_profiles) can manage all resources
  - All policies check authentication first
*/

-- Drop existing automated_reports policies
DROP POLICY IF EXISTS "Users can view own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can create own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can update own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON automated_reports;

-- Create new automated_reports policies with admin access
CREATE POLICY "Users and admins can view automation rules"
  ON automated_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users and admins can create automation rules"
  ON automated_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users and admins can update automation rules"
  ON automated_reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users and admins can delete automation rules"
  ON automated_reports
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Drop existing user_profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create new user_profiles UPDATE policy with admin access
CREATE POLICY "Users can update own profile, admins can update any"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- Add DELETE policy for user_profiles
CREATE POLICY "Admins can delete user profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );