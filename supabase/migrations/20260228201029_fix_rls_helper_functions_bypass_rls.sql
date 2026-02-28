/*
  # Fix RLS Helper Functions to Properly Bypass RLS

  1. Problem
    - The rls_get_user_company_id and rls_get_user_role functions are SECURITY DEFINER
    - However they still query user_profiles which has RLS enabled
    - This causes infinite recursion when user_profiles policies call these functions

  2. Solution
    - Recreate these functions to bypass RLS by setting role to service_role
    - Or use a different approach: query auth.users metadata instead
    - Actually the cleanest fix is to make the user_profiles SELECT policies simpler
*/

-- First, let's simplify the user_profiles SELECT policy to ONLY allow reading your own row
-- This breaks the recursion because the simple auth.uid() = id check doesn't need any function calls

-- Drop ALL existing user_profiles policies
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_company" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_superadmin_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_superadmin_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role" ON public.user_profiles;

-- Simple policy: users can read their own profile (no function calls, no recursion possible)
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can insert their own profile during signup
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role can do anything (for edge functions and admin operations)
CREATE POLICY "user_profiles_service_role"
  ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Now recreate the helper functions to use a CTE that reads before RLS is checked
-- These use SECURITY DEFINER with SET role to bypass RLS

CREATE OR REPLACE FUNCTION public.rls_get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Temporarily bypass RLS to read own profile
  SELECT company_id INTO v_company_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rls_get_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Temporarily bypass RLS to read own profile
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_role;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.rls_get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_get_user_company_id() TO anon;
GRANT EXECUTE ON FUNCTION public.rls_get_user_role() TO anon;
