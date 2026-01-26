/*
  # Add custom line item options to company settings

  1. Changes
    - Add `custom_line_item_options` column to company_settings table to store custom line item options
    - This column will store an array of custom option names that can be added to quotes/invoices
    - Default value is an empty array
  
  2. Schema
    - `custom_line_item_options` (text array) - stores custom option names like "Other", "Special Size", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'custom_line_item_options'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN custom_line_item_options text[] DEFAULT '{}';
  END IF;
END $$;