/*
  # Fix User Profile Authentication for Edge Functions
  
  The edge function needs to query user_profiles to get the user's company_id,
  but the RLS policy prevents this by requiring company_id = get_user_company_id().
  This creates a circular dependency.
  
  Solution: Allow users to always view their own profile by id = auth.uid(),
  without requiring company_id matching.
  
  ## Changes
  - Drop the existing "Users can view own profile" policy  
  - Create a new policy that allows users to view their own profile without company_id check
  - Keep the policy for viewing other profiles in the same company
*/

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
END $$;

-- Allow users to ALWAYS view their own profile (no company_id check needed)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow users to view other profiles in their company (if they have a company_id)
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id != auth.uid() AND
    company_id IS NOT NULL AND
    company_id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );
