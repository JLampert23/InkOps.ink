/*
  # Add Size Mode Support to Quote Line Items

  1. Changes to quote_line_items table
    - Add `size_mode` column - determines which size set is active (regular, double, youth, adult)
    - Add `regular_sizes` (jsonb) - stores quantities for regular sizes (YS, YM, YL, XS, S, M, L, XL, 2XL, 3XL, 4XL)
    - Add `double_sizes` (jsonb) - stores quantities for double sizes (SM, LXL, YSYM, YLYXL)
    - Add `youth_sizes` (jsonb) - stores quantities for youth-only sizes (YXS, YS, YM, YL, YXL)
    - Add `adult_sizes` (jsonb) - stores quantities for adult-only sizes (XS, S, M, L, XL, 2XL, 3XL, 4XL)

  2. Purpose
    - Reduce UI clutter by allowing users to switch between different size sets
    - Preserve all size data across mode switches
    - Provide specialized size options for different garment types

  3. Default Values
    - size_mode defaults to 'regular'
    - All size JSON fields default to empty objects
*/

DO $$
BEGIN
  -- Add size_mode column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'size_mode'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN size_mode text DEFAULT 'regular';
  END IF;

  -- Add regular_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'regular_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN regular_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add double_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'double_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN double_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add youth_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'youth_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN youth_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add adult_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'adult_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN adult_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add check constraint to ensure size_mode is one of the allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_line_items_size_mode_check'
  ) THEN
    ALTER TABLE quote_line_items 
    ADD CONSTRAINT quote_line_items_size_mode_check 
    CHECK (size_mode IN ('regular', 'double', 'youth', 'adult'));
  END IF;
END $$;