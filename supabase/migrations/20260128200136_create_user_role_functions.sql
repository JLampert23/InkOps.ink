/*
  # Create User Role Functions

  1. New Functions
    - `get_user_role` - Returns the role of a user
    - `get_user_company_id` - Returns the company_id of a user

  2. Purpose
    - Used by edge functions to check user permissions
    - Simplifies role checking across the application

  3. Security
    - Functions use SECURITY DEFINER to bypass RLS
    - Only accessible to authenticated users
*/

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN user_role;
END;
$$;

-- Function to get user company_id
CREATE OR REPLACE FUNCTION get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
BEGIN
  SELECT company_id INTO user_company_id
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN user_company_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_company_id(uuid) TO authenticated;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_company_id(uuid) TO service_role;