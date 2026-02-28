/*
  # Fix Company Settings RLS Recursion

  1. Problem
    - Company settings policies use get_user_company_id() which queries user_profiles
    - This can cause issues when combined with user_profiles RLS

  2. Solution
    - Update policies to use the new SECURITY DEFINER function rls_get_user_company_id()
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON public.company_settings;

-- Recreate with the SECURITY DEFINER function
CREATE POLICY "Users can view their company settings"
  ON public.company_settings
  FOR SELECT
  TO authenticated
  USING (id = public.rls_get_user_company_id());

CREATE POLICY "Users can update their company settings"
  ON public.company_settings
  FOR UPDATE
  TO authenticated
  USING (id = public.rls_get_user_company_id())
  WITH CHECK (id = public.rls_get_user_company_id());
