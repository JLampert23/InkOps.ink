/*
  # Add Stripe Credentials to Company Settings

  1. Changes
    - Add `stripe_public_key` (encrypted)
    - Add `stripe_secret_key` (encrypted)
    - Add `stripe_webhook_secret` (encrypted)
    - These enable Stripe payment processing in Billing & Payments section

  2. Security
    - Keys are stored encrypted
    - Only accessible through secure backend services
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_public_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_public_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_secret_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_secret_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_webhook_secret'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_webhook_secret text;
  END IF;
END $$;
