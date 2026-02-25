/*
  # Fix User Profiles RLS Infinite Recursion

  ## Problem
  The SELECT policy on user_profiles calls get_user_company_id() which queries user_profiles,
  causing infinite recursion and preventing users from reading their own profile.

  ## Solution
  1. Create a SECURITY DEFINER function to get company_id that bypasses RLS
  2. Update the SELECT policy to allow users to read their own profile directly
  3. Use the security definer function for cross-company checks

  ## Changes
  - Add policy allowing users to read their own profile (no recursion)
  - Update existing policy to use security definer function
*/

-- First, create a security definer function that bypasses RLS
CREATE OR REPLACE FUNCTION get_user_company_id_secure()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Drop the existing problematic SELECT policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Create a policy that allows users to read their own profile (no recursion)
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Create a separate policy for viewing other profiles in the same company
-- Using the security definer function to avoid recursion
CREATE POLICY "Users can view other profiles in their company"
  ON user_profiles
  FOR SELECT
  USING (company_id = get_user_company_id_secure());
