/*
  # Add Missing Quote Numbering Columns

  1. Changes
    - Add `quote_prefix` column for quote number prefix (e.g., "QTE")
    - Add `use_quote_prefix` column to enable/disable prefix
    - Add `quote_start_number` column for starting sequence
    - Set defaults for all existing companies

  2. Security
    - No RLS changes needed
*/

-- Add quote numbering columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'quote_prefix'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN quote_prefix text DEFAULT 'QTE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'use_quote_prefix'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN use_quote_prefix boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'quote_start_number'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN quote_start_number integer DEFAULT 1;
  END IF;
END $$;

-- Update existing rows to have default values
UPDATE company_settings 
SET 
  quote_prefix = COALESCE(quote_prefix, 'QTE'),
  use_quote_prefix = COALESCE(use_quote_prefix, true),
  quote_start_number = COALESCE(quote_start_number, 1)
WHERE quote_prefix IS NULL 
   OR use_quote_prefix IS NULL 
   OR quote_start_number IS NULL;
