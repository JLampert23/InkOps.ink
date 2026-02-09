/*
  # Update SanMar to PromoStandards Credentials Schema

  1. Changes
    - Rename `sanmar_username` to `sanmar_promo_username` for clarity
    - Rename `sanmar_password_encrypted` to `sanmar_promo_password_encrypted` for clarity
    - Keep `sanmar_account_number` for reference
    - Keep `sanmar_enabled` flag

  2. Notes
    - SanMar PromoStandards API only requires username and password
    - No API keys or FTP credentials are used
    - Account number is kept for reference/organization purposes only
*/

-- Rename username column to clarify it's for PromoStandards
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings'
    AND column_name = 'sanmar_username'
  ) THEN
    ALTER TABLE company_settings
    RENAME COLUMN sanmar_username TO sanmar_promo_username;
  END IF;
END $$;

-- Rename password column to clarify it's for PromoStandards
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings'
    AND column_name = 'sanmar_password_encrypted'
  ) THEN
    ALTER TABLE company_settings
    RENAME COLUMN sanmar_password_encrypted TO sanmar_promo_password_encrypted;
  END IF;
END $$;

-- Drop any old FTP or API key columns if they exist
ALTER TABLE company_settings
DROP COLUMN IF EXISTS sanmar_api_key_encrypted,
DROP COLUMN IF EXISTS sanmar_ftp_customer_number,
DROP COLUMN IF EXISTS sanmar_ftp_password_encrypted;