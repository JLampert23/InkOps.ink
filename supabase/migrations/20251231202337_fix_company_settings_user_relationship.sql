/*
  # Fix Company Settings User Relationship

  ## Problem
  The company_settings table has no relationship to auth.users, causing issues when
  multiple users exist in the system. The getCompanySettings query has no filter,
  so it doesn't know which company settings to return.

  ## Changes

  ### Modified Tables
  
  #### company_settings
  - Add `owner_id` (uuid, foreign key to auth.users) - The user who owns this company
  - Backfill existing records with the first user's ID (for initial setup)
  - Make owner_id NOT NULL after backfill

  ## Security Changes
  
  Update RLS policies to ensure users can only access their own company settings:
  - SELECT: Users can only read their own company settings (owner_id = auth.uid())
  - INSERT: Users can only create company settings where they are the owner
  - UPDATE: Users can only update their own company settings
*/

-- Add owner_id column (nullable initially for backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill existing company_settings with the corresponding user
-- Match by checking user_profiles created around the same time
UPDATE company_settings cs
SET owner_id = (
  SELECT up.id 
  FROM user_profiles up 
  WHERE up.created_at <= cs.created_at + interval '1 minute'
    AND up.created_at >= cs.created_at - interval '1 minute'
  ORDER BY up.created_at
  LIMIT 1
)
WHERE owner_id IS NULL;

-- If no match found by time, use the first admin user
UPDATE company_settings cs
SET owner_id = (
  SELECT id FROM user_profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1
)
WHERE owner_id IS NULL;

-- Make owner_id required
ALTER TABLE company_settings ALTER COLUMN owner_id SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_owner_id ON company_settings(owner_id);

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can read company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;

-- Create new restrictive policies
CREATE POLICY "Users can read own company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
