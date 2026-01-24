/*
  # Add Thread/Ink Color Field to Quote Imprints

  1. Changes
    - Add `thread_ink_color` column to `quote_imprints` table to store selected thread/ink colors
    - This field is optional and stores the color name selected from the color_stitch_options table

  2. Notes
    - This allows users to specify which thread or ink color is being used for each imprint
    - Values come from the Thread and Ink Colors section in General Settings
*/

-- Add thread_ink_color column to quote_imprints table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_imprints' AND column_name = 'thread_ink_color'
  ) THEN
    ALTER TABLE quote_imprints ADD COLUMN thread_ink_color text;
  END IF;
END $$;