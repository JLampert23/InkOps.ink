/*
  # Add Selected Colors to Proofs Table

  1. Changes
    - Add `selected_colors` column to `proofs` table
      - Stores array of selected ink or thread colors
      - Based on the type_of_work field
  
  2. Notes
    - Uses JSONB array format for flexible color storage
    - Allows multiple colors to be selected per mockup
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'selected_colors'
  ) THEN
    ALTER TABLE proofs ADD COLUMN selected_colors jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
