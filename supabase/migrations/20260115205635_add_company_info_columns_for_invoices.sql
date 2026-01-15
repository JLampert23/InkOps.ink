/*
  # Add Company Information Columns for Invoice PDFs

  1. New Columns
    - `company_address` (text, nullable) - Company address for invoice headers
    - `company_phone` (text, nullable) - Company phone number for invoice headers
    - `company_email` (text, nullable) - Company email for invoice headers
    - `company_website` (text, nullable) - Company website for invoice footers
    - `invoice_terms` (text, nullable) - Default invoice terms and conditions

  2. Purpose
    - These columns are used to populate professional invoice PDFs
    - Company information appears in invoice headers
    - Website appears in invoice footers
    - Terms appear in invoice terms section

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add company information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_address'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_phone'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_website'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'invoice_terms'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN invoice_terms text;
  END IF;
END $$;
