/*
  # Add Printavo API Credentials to Company Settings

  ## Changes
  
  This migration adds secure storage for Printavo API credentials to enable 
  multi-tenant authentication where each company stores their own Printavo 
  API access credentials.

  ### Modified Tables
  
  #### company_settings
  - Add `printavo_username` (text, nullable) - Printavo account email/username
  - Add `printavo_api_token_encrypted` (text, nullable) - AES-256 encrypted Printavo API token
  - Add `encryption_key_version` (text, default 'v1') - Track which encryption key version was used

  ## Security Notes
  
  - API tokens are stored encrypted using AES-256-GCM
  - Encryption/decryption happens server-side via Edge Functions
  - The encryption key is stored as an environment variable, never in the database
  - RLS policies remain unchanged (authenticated users only)
  
  ## Usage
  
  After signup, companies will provide:
  1. Company name
  2. Email & password (for Supabase auth)
  3. Printavo username
  4. Printavo API token (encrypted before storage)
*/

-- Add Printavo credentials fields to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'printavo_username'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN printavo_username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'printavo_api_token_encrypted'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN printavo_api_token_encrypted text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'encryption_key_version'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN encryption_key_version text DEFAULT 'v1';
  END IF;
END $$;

-- Create an index on printavo_username for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_printavo_username 
  ON company_settings(printavo_username);

-- Add a constraint to ensure that if api_token is set, username must also be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'printavo_credentials_complete'
  ) THEN
    ALTER TABLE company_settings
    ADD CONSTRAINT printavo_credentials_complete
    CHECK (
      (printavo_api_token_encrypted IS NULL AND printavo_username IS NULL) OR
      (printavo_api_token_encrypted IS NOT NULL AND printavo_username IS NOT NULL)
    );
  END IF;
END $$;
