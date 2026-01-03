/*
  # Add Resend API credentials to company settings

  1. Changes
    - Add `resend_api_key` column to `company_settings` table
      - Stored encrypted for security
      - Nullable (optional integration)
    
  2. Security
    - Column will store encrypted API key from Resend
    - Encrypted via crypto-service edge function before storage
    - Never exposed to frontend in plain text
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_api_key text;
  END IF;
END $$;