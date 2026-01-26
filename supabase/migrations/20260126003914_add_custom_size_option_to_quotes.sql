/*
  # Add custom_size_option column to quotes table

  1. Changes
    - Add `custom_size_option` column to `quotes` table
    - This moves the custom size selection from per-line-item to a global quote setting
    - The value will be stored at the quote level and applies to all line items

  2. Migration Details
    - Adds nullable text column for flexibility
    - Safe to run multiple times (IF NOT EXISTS check included)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'custom_size_option'
  ) THEN
    ALTER TABLE quotes ADD COLUMN custom_size_option text;
  END IF;
END $$;
