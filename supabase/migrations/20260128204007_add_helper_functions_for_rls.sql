/*
  # Add Helper Functions for RLS Performance
  
  1. Purpose
    - Create helper functions that bypass RLS for internal lookups
    - Avoid circular dependencies in RLS policies
    - Improve query performance
  
  2. Functions
    - get_user_company_id(): Returns the company_id for current user
    - get_user_role(): Returns the role for current user
  
  3. Security
    - These functions are SECURITY DEFINER (run with creator privileges)
    - They only return data for the authenticated user
    - Cannot be used to bypass security, only to optimize queries
*/

-- Function to get current user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role 
  FROM public.user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Now update company_settings policies to use the helper function
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;

CREATE POLICY "Users can view their company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

CREATE POLICY "Users can update their company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (id = get_user_company_id())
  WITH CHECK (id = get_user_company_id());
