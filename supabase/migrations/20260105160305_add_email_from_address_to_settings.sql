/*
  # Add Email From Address to Company Settings

  1. Changes
    - Add `email_from_address` column to `company_settings` table
    - This will store the email address to use as the "from" address when sending emails
    - Must use an email from the verified domain in Resend

  2. Notes
    - Default to empty string, user must configure this in settings
    - This should be an email like: invoices@toddssportinggoods.com or noreply@toddssportinggoods.com
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_from_address'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_from_address text DEFAULT '';
  END IF;
END $$;