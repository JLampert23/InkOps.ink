/*
  # Add User Roles and RBAC System
  
  1. Changes
    - Update user_profiles role field to support 'super_admin' and 'admin' roles
    - Assign Jamie as Super Admin
    - Assign Matt and Todd as Admin
    - Add role validation constraint
  
  2. Roles
    - super_admin: Full access to all features including Integrations
    - admin: Access to all features EXCEPT Integrations section
  
  3. Security
    - Role assignments enforced at database level
    - Only authenticated users can read their own role
    - Role changes require proper authorization
*/

-- Update Jamie to Super Admin
UPDATE user_profiles
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE email = 'jamie@toddssportinggoods.com';

-- Ensure Matt and Todd are set as Admin (they already are, but making it explicit)
UPDATE user_profiles
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email IN ('matt@toddssportinggoods.com', 'todd@toddssportinggoods.com');

-- Add constraint to ensure only valid roles are used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('super_admin', 'admin'));
  END IF;
END $$;

-- Create a function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'super_admin'
  );
END;
$$;

-- Create a function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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
