/*
  # Add S&S Activewear Internal ID to Styles Table

  1. Changes
    - Add `ss_internal_id` column to `styles` table to store the S&S internal styleID
    - This internal ID is required for the S&S Pricing API (format: B + 5-digit padded number)
    - Example: styleID 372 becomes "B00372" for pricing lookups

  2. Notes
    - The internal ID is NOT derivable from the customer-facing style number
    - It must be fetched from the S&S REST API and cached for pricing lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'styles' AND column_name = 'ss_internal_id'
  ) THEN
    ALTER TABLE styles ADD COLUMN ss_internal_id text;
  END IF;
END $$;

COMMENT ON COLUMN styles.ss_internal_id IS 'S&S Activewear internal styleID used for pricing API lookups (format: numeric ID that gets B-prefixed)';