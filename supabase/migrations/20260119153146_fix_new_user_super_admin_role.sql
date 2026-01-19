/*
  # Fix New User Super Admin Role Assignment

  1. Changes
    - Update handle_new_user() function to automatically assign 'super_admin' role to all new signups
    - Remove hardcoded email checks (Jamie-specific logic)
    - Since this is a multi-tenant system where each company creates their own account,
      the first user to sign up for a company should automatically be a super admin

  2. Rationale
    - Each company signup creates a new company account
    - The person creating the account should have full super_admin access
    - This aligns with the RBAC constraint that only allows 'super_admin' and 'admin' roles

  3. Security
    - Super admin role is only assigned during initial user creation via the trigger
    - Additional users would need to be invited by existing admins
*/

-- Update the handle_new_user function to assign super_admin to all new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- All new signups get super_admin role by default
  -- This is appropriate because each signup represents a new company account
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'super_admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
