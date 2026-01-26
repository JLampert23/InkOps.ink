/*
  # Add Double Size Columns to Quote Line Items

  1. Changes to quote_line_items table
    - Add `qty_sm` (integer) - quantity for S/M double size
    - Add `qty_lxl` (integer) - quantity for L/XL double size
    - Add `qty_ysym` (integer) - quantity for YS/YM double size
    - Add `qty_ylyxl` (integer) - quantity for YL/YXL double size

  2. Purpose
    - Support double size mode where sizes are combined (e.g., S/M instead of separate S and M)
    - Provide flexibility for different garment types and ordering preferences

  3. Default Values
    - All double size columns default to 0
*/

DO $$
BEGIN
  -- Add qty_sm column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_sm'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_sm integer DEFAULT 0;
  END IF;

  -- Add qty_lxl column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_lxl'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_lxl integer DEFAULT 0;
  END IF;

  -- Add qty_ysym column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_ysym'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ysym integer DEFAULT 0;
  END IF;

  -- Add qty_ylyxl column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_ylyxl'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ylyxl integer DEFAULT 0;
  END IF;
END $$;