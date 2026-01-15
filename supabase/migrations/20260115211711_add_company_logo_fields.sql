/*
  # Add Company Logo Fields to Company Settings

  1. Changes
    - Add `company_logo_primary_url` field for primary logo (invoices, emails, customer-facing)
    - Add `company_logo_secondary_url` field for secondary logo (dark mode, alternate layouts)
    - Both fields are nullable text fields to store logo URLs from Supabase Storage
  
  2. Purpose
    - Enable companies to upload and store two logos for different branding purposes
    - Primary logo: main branding for invoices, emails, and customer communications
    - Secondary logo: alternative branding for dark mode or watermarking
*/

-- Add primary logo URL field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_logo_primary_url'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_logo_primary_url text;
  END IF;
END $$;

-- Add secondary logo URL field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_logo_secondary_url'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_logo_secondary_url text;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN company_settings.company_logo_primary_url IS 'URL to primary company logo stored in Supabase Storage. Used for invoices, emails, and customer-facing branding.';
COMMENT ON COLUMN company_settings.company_logo_secondary_url IS 'URL to secondary company logo stored in Supabase Storage. Used for dark mode, alternate layouts, or watermarking.';
