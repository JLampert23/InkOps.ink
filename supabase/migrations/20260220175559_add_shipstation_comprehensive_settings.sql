/*
  # Add Comprehensive ShipStation Integration Settings

  1. Changes
    - Add `shipstation_default_ship_from_name` column
    - Add `shipstation_default_ship_from_company` column
    - Add `shipstation_default_ship_from_address1` column
    - Add `shipstation_default_ship_from_address2` column
    - Add `shipstation_default_ship_from_city` column
    - Add `shipstation_default_ship_from_state` column
    - Add `shipstation_default_ship_from_postal_code` column
    - Add `shipstation_default_ship_from_country` column
    - Add `shipstation_default_carrier_code` column
    - Add `shipstation_default_service_code` column

  2. Purpose
    - Store comprehensive ShipStation integration settings
    - Enable default shipping address and carrier preferences
    - Support automated order fulfillment workflows

  3. Security
    - No RLS changes needed (inherits existing company_settings policies)
    - API credentials encrypted at application layer
*/

-- Add ShipStation comprehensive settings to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_name'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_company'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_company text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_address1'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_address1 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_address2'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_address2 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_city'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_state'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_postal_code'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_postal_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_ship_from_country'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_ship_from_country text DEFAULT 'US';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_carrier_code'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_carrier_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'shipstation_default_service_code'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN shipstation_default_service_code text;
  END IF;
END $$;

COMMENT ON COLUMN company_settings.shipstation_default_ship_from_name IS 'Default ship from contact name for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_company IS 'Default ship from company name for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_address1 IS 'Default ship from address line 1 for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_address2 IS 'Default ship from address line 2 for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_city IS 'Default ship from city for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_state IS 'Default ship from state for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_postal_code IS 'Default ship from postal code for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_ship_from_country IS 'Default ship from country code for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_carrier_code IS 'Default carrier code for ShipStation orders';
COMMENT ON COLUMN company_settings.shipstation_default_service_code IS 'Default service code for ShipStation orders';