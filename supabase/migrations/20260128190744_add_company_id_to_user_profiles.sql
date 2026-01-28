/*
  # Add company_id to user_profiles

  Critical fix: Add company_id column to link users to their companies
*/

-- Add company_id column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE;

-- Create index for company_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);

-- Backfill company_id for existing users (set all to first company)
DO $$
DECLARE
  first_company_id uuid;
BEGIN
  SELECT id INTO first_company_id FROM company_settings LIMIT 1;
  
  IF first_company_id IS NOT NULL THEN
    UPDATE user_profiles
    SET company_id = first_company_id
    WHERE company_id IS NULL;
  END IF;
END $$;

-- Make company_id NOT NULL after backfilling
ALTER TABLE user_profiles
ALTER COLUMN company_id SET NOT NULL;
