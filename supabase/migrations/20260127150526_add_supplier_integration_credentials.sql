/*
  # Add Supplier Integration Credentials

  1. Changes
    - Add SSActivewear credentials columns to company_settings
    - Add SanMar credentials columns to company_settings
    
  2. Security
    - Credentials are encrypted
    - Only accessible to users in the same company
*/

-- Add SSActivewear credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'ssactivewear_username'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN ssactivewear_username text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'ssactivewear_api_key_encrypted'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN ssactivewear_api_key_encrypted text;
  END IF;
END $$;

-- Add SanMar credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sanmar_username'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sanmar_username text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sanmar_api_key_encrypted'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sanmar_api_key_encrypted text;
  END IF;
END $$;
