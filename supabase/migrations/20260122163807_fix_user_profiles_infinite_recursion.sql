/*
  # Fix Infinite Recursion in user_profiles RLS Policy

  1. Problem
    - The RLS policy for viewing profiles in the same company queries user_profiles table
    - This causes infinite recursion: policy checks -> query user_profiles -> policy checks -> loop
    - Results in "infinite recursion detected in policy" error

  2. Solution
    - Create a helper function that bypasses RLS to get current user's company_id
    - Use SECURITY DEFINER to bypass RLS
    - Update the RLS policy to use this function instead of direct table query

  3. Changes
    - Create get_user_company_id() function
    - Replace problematic RLS policy with fixed version
*/

-- Create a helper function to get user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id 
  FROM user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Create a new policy without recursion
CREATE POLICY "Users can view profiles in their company"
ON user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR 
  company_id = get_user_company_id()
);
