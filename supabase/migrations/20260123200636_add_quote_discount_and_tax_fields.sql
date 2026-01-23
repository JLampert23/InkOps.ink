/*
  # Add discount and tax fields to quotes

  1. Changes to quotes table
    - Add discount_type column ($ or %)
    - Add sales_tax_rate column
    - Add sales_tax column

  2. Changes to quote_line_items table
    - Add taxed boolean column
    - Add sort_order column for proper ordering
*/

-- Add discount_type, sales_tax_rate, and sales_tax to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE quotes ADD COLUMN discount_type text DEFAULT '$';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'sales_tax_rate'
  ) THEN
    ALTER TABLE quotes ADD COLUMN sales_tax_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'sales_tax'
  ) THEN
    ALTER TABLE quotes ADD COLUMN sales_tax numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'discount'
  ) THEN
    ALTER TABLE quotes ADD COLUMN discount numeric DEFAULT 0;
  END IF;
END $$;

-- Add taxed and sort_order columns to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'taxed'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN taxed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;
