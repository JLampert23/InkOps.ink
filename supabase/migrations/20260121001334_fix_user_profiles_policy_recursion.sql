/*
  # Fix user_profiles policy that causes infinite recursion
  
  1. Problem
    - The "Users can view profiles in their company" policy directly queries user_profiles
    - This causes infinite recursion when RLS checks the policy
  
  2. Solution
    - Replace the inline subquery with get_user_company_id() function
    - The function is now SECURITY DEFINER so it bypasses RLS
  
  3. Security
    - Same access control as before, just without the recursion
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Recreate it using the SECURITY DEFINER function
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id <> auth.uid() 
    AND company_id IS NOT NULL 
    AND company_id = get_user_company_id()
  );
