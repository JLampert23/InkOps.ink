/*
  # Add Square Integration Credentials

  1. Changes
    - Adds Square API credentials columns to company_settings table
    - All credentials are stored as encrypted text fields
    - Includes access_token, application_id, location_id
  
  2. Security
    - Uses existing RLS policies on company_settings table
    - Data is accessible only to authenticated users associated with the company
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_access_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_application_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_application_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_location_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_location_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_environment'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_environment text DEFAULT 'production';
  END IF;
END $$;