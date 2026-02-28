/*
  # Fix User Profile Initial Insert Policy
  
  ## Problem
  New users cannot sign up because the INSERT policy on user_profiles requires
  get_user_role() = 'super_admin', but that function looks up user_profiles
  which doesn't exist yet for new users.
  
  ## Solution
  1. Drop the restrictive INSERT policy
  2. Create a new policy that allows:
     - Users to insert their OWN profile (id = auth.uid())
     - Super admins to insert profiles for their company
  
  ## Security
  - Users can only insert a profile with their own auth.uid() as the id
  - This prevents users from creating profiles for other users
  - Super admins retain ability to create profiles in their company
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Super admins can insert user profiles in their company" ON user_profiles;

-- Create a new policy that allows users to create their own initial profile
CREATE POLICY "Users can create their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can only insert a profile with their own ID
    id = auth.uid()
  );

-- Create a separate policy for super admins to add team members
CREATE POLICY "Super admins can add team members"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- For team members (not self), must be super_admin in same company
    id != auth.uid() 
    AND company_id = get_user_company_id() 
    AND get_user_role() = 'super_admin'
  );
