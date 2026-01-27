/*
  # Fix Companies Table Sync
  
  ## Problem
  The `companies` table was empty, causing foreign key constraint violations
  when creating production_stations and other records that reference companies.
  
  ## Solution
  1. Backfill companies table with existing company_settings data
  2. Create trigger to keep companies table in sync when company_settings changes
  
  ## Changes
  - Populate companies table from company_settings
  - Add trigger to sync company name changes from company_settings to companies
*/

-- Backfill companies table (already done via direct SQL, but safe to run again)
INSERT INTO companies (id, name, created_at, updated_at)
SELECT id, company_name, created_at, updated_at 
FROM company_settings
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = EXCLUDED.updated_at;

-- Create function to sync company name changes
CREATE OR REPLACE FUNCTION sync_company_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- When company_settings is updated, update the corresponding company name
  UPDATE public.companies
  SET name = NEW.company_name,
      updated_at = NEW.updated_at
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on company_settings
DROP TRIGGER IF EXISTS sync_company_name_trigger ON company_settings;
CREATE TRIGGER sync_company_name_trigger
  AFTER UPDATE OF company_name ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION sync_company_name();

-- Also ensure handle_new_user creates company records properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_company_id uuid;
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    -- First user - create new company
    new_company_id := gen_random_uuid();
    
    INSERT INTO public.companies (id, name, created_at, updated_at)
    VALUES (new_company_id, 'My Company', now(), now());

    INSERT INTO public.user_profiles (id, email, full_name, role, company_id, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'super_admin',
      new_company_id,
      now(),
      now()
    );

    INSERT INTO public.company_settings (id, company_name, owner_id, created_at, updated_at)
    VALUES (new_company_id, 'My Company', NEW.id, now(), now());
  ELSE
    -- Additional users join the first company
    SELECT company_id INTO new_company_id FROM public.user_profiles LIMIT 1;

    INSERT INTO public.user_profiles (id, email, full_name, role, company_id, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'user',
      new_company_id,
      now(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;
