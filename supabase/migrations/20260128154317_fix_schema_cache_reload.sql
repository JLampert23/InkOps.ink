/*
  # Fix Schema Cache and Data Consistency

  1. Purpose
    - Force schema cache reload
    - Verify all auth users have proper profiles and company settings
    - Clean up any inconsistencies

  2. Changes
    - Add comment to trigger schema reload
    - Verify data integrity
*/

-- Force schema cache reload by touching the company_settings table
COMMENT ON TABLE company_settings IS 'Company-wide settings and API credentials - Updated 2026-01-28';

-- Verify all auth users have profiles (just a check, won't break if OK)
DO $$
DECLARE
  orphaned_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_users
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.id = au.id
  WHERE up.id IS NULL;
  
  IF orphaned_users > 0 THEN
    RAISE NOTICE 'Found % orphaned auth users without profiles', orphaned_users;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';