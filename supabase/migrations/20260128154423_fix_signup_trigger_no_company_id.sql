/*
  # Fix Signup Trigger - Remove Company ID References

  1. Purpose
    - Fix the signup trigger that was failing
    - Remove references to non-existent company_id column in user_profiles
    - Ensure proper company_settings creation

  2. Changes
    - Update handle_new_user function to work with actual schema
    - Remove company_id references from user_profiles inserts
*/

-- Drop and recreate the signup function without company_id references
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_company_id uuid;
  user_count integer;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    -- First user ever - create new company
    new_company_id := gen_random_uuid();

    -- Create user profile
    INSERT INTO public.user_profiles (
      id, 
      email, 
      full_name, 
      role, 
      created_at, 
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'super_admin',
      now(),
      now()
    );

    -- Create company settings
    INSERT INTO public.company_settings (
      id, 
      company_name, 
      owner_id, 
      created_at, 
      updated_at
    )
    VALUES (
      new_company_id, 
      'My Company', 
      NEW.id, 
      now(), 
      now()
    );
  ELSE
    -- Additional users - standard user role
    INSERT INTO public.user_profiles (
      id, 
      email, 
      full_name, 
      role, 
      created_at, 
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'user',
      now(),
      now()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't break auth
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Force schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';