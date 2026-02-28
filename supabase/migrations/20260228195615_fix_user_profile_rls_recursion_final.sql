/*
  # Fix User Profile RLS Infinite Recursion (Final)

  1. Problem
    - User login fails because RLS policies on user_profiles create infinite recursion
    - The policy "Users can view other profiles in their company" calls get_user_company_id_secure()
    - That function queries user_profiles, which triggers RLS, which calls the function again

  2. Solution
    - Drop the problematic policies that cause recursion
    - Create SECURITY DEFINER functions in public schema that bypass RLS
    - Create simple, non-recursive policies

  3. Security
    - Users can still only read their own profile or profiles in their company
    - Service role retains full access
    - No infinite recursion possible
*/

-- First, drop ALL existing user_profiles policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view other profiles in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can add team members" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can delete user profiles in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role has full access to user profiles" ON public.user_profiles;

-- Drop any recently created policies too
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_company" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_superadmin_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_superadmin_delete" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role" ON public.user_profiles;

-- Create a SECURITY DEFINER function that bypasses RLS to get user's company_id
-- This prevents infinite recursion
DROP FUNCTION IF EXISTS public.rls_get_user_company_id();
CREATE OR REPLACE FUNCTION public.rls_get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.rls_get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_get_user_company_id() TO anon;

-- Create a SECURITY DEFINER function to get user's role
DROP FUNCTION IF EXISTS public.rls_get_user_role();
CREATE OR REPLACE FUNCTION public.rls_get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.rls_get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_get_user_role() TO anon;

-- Now create the new RLS policies using the SECURITY DEFINER functions

-- 1. Users can SELECT their own profile (simple, no recursion)
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2. Users can SELECT other profiles in their company (using SECURITY DEFINER function)
CREATE POLICY "user_profiles_select_company"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = public.rls_get_user_company_id());

-- 3. Users can INSERT their own profile during signup
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. Users can UPDATE their own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. Admins can UPDATE profiles in their company
CREATE POLICY "user_profiles_admin_update"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.rls_get_user_company_id()
    AND public.rls_get_user_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    company_id = public.rls_get_user_company_id()
  );

-- 6. Super admins can INSERT new team members
CREATE POLICY "user_profiles_superadmin_insert"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id <> auth.uid()
    AND company_id = public.rls_get_user_company_id()
    AND public.rls_get_user_role() = 'super_admin'
  );

-- 7. Super admins can DELETE profiles in their company
CREATE POLICY "user_profiles_superadmin_delete"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.rls_get_user_company_id()
    AND public.rls_get_user_role() = 'super_admin'
  );

-- 8. Service role has full access (for backend operations)
CREATE POLICY "user_profiles_service_role"
  ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
