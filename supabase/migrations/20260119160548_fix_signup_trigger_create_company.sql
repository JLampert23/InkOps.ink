/*
  # Fix Signup Trigger to Create Company First
  
  1. Problem
    - The handle_new_user() trigger tries to insert into user_profiles
    - But user_profiles.company_id is now a required foreign key
    - The trigger doesn't create a company first, causing 500 errors
  
  2. Solution
    - Update handle_new_user() to:
      a) Create a company_settings record first (using email as company name)
      b) Then create the user_profile linked to that company
      c) Set the new user as the company owner
  
  3. Security
    - Each signup creates an isolated company environment
    - User is assigned super_admin role for their company
    - RLS policies ensure they only see their company's data
*/

-- Drop and recreate the handle_new_user function with company creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- Create a new company for this user
  -- Use email domain as company name initially (user can change it later)
  INSERT INTO public.company_settings (owner_id, company_name)
  VALUES (
    NEW.id, 
    COALESCE(
      split_part(NEW.email, '@', 1) || '''s Company',
      'My Company'
    )
  )
  RETURNING id INTO new_company_id;
  
  -- Create user profile linked to the new company
  INSERT INTO public.user_profiles (id, email, role, company_id)
  VALUES (NEW.id, NEW.email, 'super_admin', new_company_id)
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'super_admin', 
    company_id = new_company_id,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
