/*
  # Add Customer URL Support for Branded Domains
  
  1. Changes
    - Add `customer_url` column to `company_settings` table
    - This allows each company to use their own branded domain for customer-facing links
    
  2. Security
    - Add unique constraint to prevent domain duplication
    - Add check constraint to validate URL format
    
  3. Notes
    - URLs must include https://
    - Trailing slashes will be stripped before saving
    - If not set, system falls back to default INKOPS domain
*/

-- Add customer_url column to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'customer_url'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN customer_url text;
  END IF;
END $$;

-- Add unique constraint to prevent multiple companies from using the same domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_settings_customer_url_unique'
  ) THEN
    ALTER TABLE company_settings
    ADD CONSTRAINT company_settings_customer_url_unique UNIQUE (customer_url);
  END IF;
END $$;

-- Add check constraint to ensure valid URL format (must start with https://)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_settings_customer_url_format'
  ) THEN
    ALTER TABLE company_settings
    ADD CONSTRAINT company_settings_customer_url_format 
    CHECK (customer_url IS NULL OR customer_url ~ '^https://[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$');
  END IF;
END $$;

-- Add index for faster lookup by domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_company_settings_customer_url'
  ) THEN
    CREATE INDEX idx_company_settings_customer_url ON company_settings(customer_url) WHERE customer_url IS NOT NULL;
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN company_settings.customer_url IS 'Custom branded domain for customer-facing invoice and quote links. Must be unique across all companies and include https://';
