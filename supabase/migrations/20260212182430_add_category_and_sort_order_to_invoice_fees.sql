/*
  # Add Category and Sort Order to Invoice Fees

  1. Changes
    - Add `category` (text, optional) - Category for grouping fees (e.g., "Screen Printing", "Embroidery", "Setup Fees")
    - Add `sort_order` (integer, default 0) - For drag-and-drop ordering within categories
    - Create index on category for efficient grouping queries
    - Backfill sort_order based on current order

  2. Notes
    - Existing fees will have null category (displayed as "Uncategorized")
    - sort_order initialized to row number for existing fees
*/

-- Add category column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_fees' AND column_name = 'category'
  ) THEN
    ALTER TABLE invoice_fees ADD COLUMN category text;
  END IF;
END $$;

-- Add sort_order column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_fees' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE invoice_fees ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill sort_order for existing fees (order by created_at)
DO $$
DECLARE
  fee_record RECORD;
  current_order INTEGER := 0;
BEGIN
  FOR fee_record IN 
    SELECT id FROM invoice_fees ORDER BY created_at
  LOOP
    UPDATE invoice_fees SET sort_order = current_order WHERE id = fee_record.id;
    current_order := current_order + 1;
  END LOOP;
END $$;

-- Create index on category for efficient grouping
CREATE INDEX IF NOT EXISTS idx_invoice_fees_category ON invoice_fees(company_id, category) WHERE is_active = true;

-- Create composite index for sorting within categories
CREATE INDEX IF NOT EXISTS idx_invoice_fees_category_sort ON invoice_fees(company_id, category, sort_order) WHERE is_active = true;
