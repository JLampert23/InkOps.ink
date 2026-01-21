/*
  # Fix infinite recursion in user_profiles RLS policies
  
  1. Problem
    - The get_user_company_id() function queries user_profiles
    - The user_profiles RLS policies call get_user_company_id()
    - This creates infinite recursion
  
  2. Solution
    - Make get_user_company_id() a SECURITY DEFINER function
    - This allows it to bypass RLS when executing
    - Prevents the recursion loop
  
  3. Security
    - Function only returns data for the authenticated user (auth.uid())
    - Cannot be exploited to access other users' data
*/

-- Recreate get_user_company_id as SECURITY DEFINER (use OR REPLACE to avoid dropping dependencies)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id 
  FROM user_profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;

-- Recreate get_user_role as SECURITY DEFINER  
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role 
  FROM user_profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;
