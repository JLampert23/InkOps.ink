/*
  # Add ShipStation Integration

  1. Changes
    - Add `shipstation_api_key` column to `company_settings` table
    - Add `shipstation_api_secret` column to `company_settings` table
    - Store encrypted ShipStation credentials securely

  2. Purpose
    - Enable ShipStation integration for order fulfillment and shipping
    - Securely store API credentials at the company level

  3. Security
    - No RLS changes needed (inherits existing company_settings policies)
    - Credentials should be encrypted when stored (handled by application layer)
*/

-- Add ShipStation API credentials to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_api_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_api_secret'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_api_secret text;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN company_settings.shipstation_api_key IS 'Encrypted ShipStation API Key for order fulfillment integration';
COMMENT ON COLUMN company_settings.shipstation_api_secret IS 'Encrypted ShipStation API Secret for authentication';