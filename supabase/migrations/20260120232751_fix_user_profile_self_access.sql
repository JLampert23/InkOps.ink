/*
  # Fix User Profile Self-Access

  1. Changes
    - Add explicit policy for users to view their own profile
    - This ensures useRBAC hook can always load the current user's profile
    - Fixes super admin access restrictions

  2. Security
    - Users can always read their own profile data
    - Maintains existing company-based access for viewing other profiles
*/

-- Drop existing policy if it exists and recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
END $$;

-- Add policy for users to view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
