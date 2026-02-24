/*
  # Auto-generate INKOPS Subdomains for All Companies

  1. Changes
    - Create function to generate URL-safe subdomain from company name
    - Backfill inkops_subdomain for all existing companies that don't have one
    - Update handle_new_user trigger to auto-generate subdomain for new companies
    - Add unique constraint on inkops_subdomain to prevent duplicates

  2. Subdomain Format
    - Lowercase alphanumeric only (no spaces, special chars)
    - Max 30 characters
    - Must be unique across all companies

  3. Usage
    - Portal URLs become: https://{subdomain}.inkops.ink/customer/{customerId}
*/

-- Function to generate a URL-safe subdomain from company name
CREATE OR REPLACE FUNCTION generate_subdomain_from_name(company_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_subdomain TEXT;
  final_subdomain TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, remove non-alphanumeric, limit to 30 chars
  base_subdomain := LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]', '', 'g'));
  base_subdomain := SUBSTRING(base_subdomain FROM 1 FOR 30);
  
  -- Ensure at least something
  IF base_subdomain = '' OR base_subdomain IS NULL THEN
    base_subdomain := 'company';
  END IF;
  
  final_subdomain := base_subdomain;
  
  -- Check for uniqueness, append number if needed
  WHILE EXISTS (
    SELECT 1 FROM company_settings 
    WHERE inkops_subdomain = final_subdomain
  ) LOOP
    counter := counter + 1;
    final_subdomain := SUBSTRING(base_subdomain FROM 1 FOR 26) || counter::TEXT;
  END LOOP;
  
  RETURN final_subdomain;
END;
$$;

-- Backfill existing companies that don't have a subdomain
DO $$
DECLARE
  company RECORD;
BEGIN
  FOR company IN 
    SELECT id, company_name 
    FROM company_settings 
    WHERE inkops_subdomain IS NULL OR inkops_subdomain = ''
  LOOP
    UPDATE company_settings
    SET inkops_subdomain = generate_subdomain_from_name(company.company_name)
    WHERE id = company.id;
  END LOOP;
END;
$$;

-- Add unique constraint on inkops_subdomain (allow null but non-null must be unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_settings_inkops_subdomain_unique'
  ) THEN
    ALTER TABLE company_settings 
    ADD CONSTRAINT company_settings_inkops_subdomain_unique 
    UNIQUE (inkops_subdomain);
  END IF;
END;
$$;

-- Update the signup trigger to auto-generate subdomain for new companies
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_company_id uuid;
  user_count integer;
  new_subdomain text;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    -- First user ever - create new company
    new_company_id := gen_random_uuid();
    
    -- Generate subdomain (use email prefix as default company identifier)
    new_subdomain := generate_subdomain_from_name(
      COALESCE(
        NEW.raw_user_meta_data->>'company_name',
        SPLIT_PART(NEW.email, '@', 1)
      )
    );

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

    -- Create company settings with auto-generated subdomain
    INSERT INTO public.company_settings (
      id, 
      company_name, 
      owner_id,
      inkops_subdomain,
      created_at, 
      updated_at
    )
    VALUES (
      new_company_id, 
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
      NEW.id,
      new_subdomain,
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

-- Create trigger to auto-generate subdomain when company_name changes
CREATE OR REPLACE FUNCTION update_subdomain_on_company_name_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update subdomain if it was null/empty or if company name changed
  IF (NEW.inkops_subdomain IS NULL OR NEW.inkops_subdomain = '') THEN
    NEW.inkops_subdomain := generate_subdomain_from_name(NEW.company_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_generate_subdomain ON company_settings;
CREATE TRIGGER auto_generate_subdomain
  BEFORE INSERT OR UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_subdomain_on_company_name_change();

-- Force schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
