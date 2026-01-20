/*
  # Fix Infinite Recursion in User Profile RLS Policies

  1. Problem
    - The "Users can view profiles in their company" policy causes infinite recursion
    - It tries to read from user_profiles while checking if you can read user_profiles

  2. Solution
    - Create a security definer function to get user's company_id without recursion
    - Update the policy to use this function

  3. Security
    - Users can view their own profile
    - Users can view other profiles in their company
    - Function uses security definer to bypass RLS when getting company_id
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Create a security definer function to get the current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Recreate the policy using the function to avoid recursion
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());
