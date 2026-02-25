/*
  # Add Quote Terms to Company Settings

  1. New Columns
    - `quote_terms` (text) - HTML content for terms displayed on quote PDFs
  
  2. Notes
    - invoice_terms already exists
    - Both fields store HTML content for rich text formatting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'quote_terms'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN quote_terms text DEFAULT '';
  END IF;
END $$;