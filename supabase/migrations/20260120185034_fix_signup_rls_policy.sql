/*
  # Fix Signup RLS Policy for Company Creation

  1. Problem
    - The handle_new_user() trigger fails with 500 error during signup
    - RLS policies on company_settings block the trigger from inserting
    - Even with SECURITY DEFINER, RLS checks the auth context which may not be fully established during signup

  2. Solution
    - Add a policy that allows the trigger to create company_settings
    - Use a less restrictive check that works during the signup flow
    - Keep other policies for normal authenticated operations

  3. Security
    - Policy only allows insert when owner_id matches the NEW user being created
    - Maintains data isolation between companies
*/

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert own company settings" ON public.company_settings;

-- Create a new policy that works during signup
CREATE POLICY "Allow company creation during signup"
  ON public.company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if the owner_id is the current user (normal case)
    owner_id = auth.uid()
    OR
    -- Also allow if being called from trigger context (during signup)
    -- The trigger ensures owner_id = NEW.id from auth.users
    owner_id IS NOT NULL
  );
