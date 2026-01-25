/*
  # Add Missing Quote Fields for QuoteBuilder

  1. Purpose
    - Add missing fields that QuoteBuilder component expects
    - Support for billing/shipping address fields
    - Add date and note fields

  2. New Columns to `quotes` table
    - Customer billing address fields (bill_company, bill_name, bill_address_1, etc.)
    - Customer shipping address fields (ship_company, ship_name, ship_address_1, etc.)
    - Date fields (created_date, production_due_date, customer_due_date)
    - Note fields (nickname, production_notes - customer_notes already exists)

  3. Changes to `quote_line_items` table
    - Add taxed boolean field to support tax calculations
    - Add sort_order field to maintain item order

  4. Security
    - No RLS changes needed (already secured by company_id)
*/

-- Add billing address fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_company') THEN
    ALTER TABLE quotes ADD COLUMN bill_company text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_name') THEN
    ALTER TABLE quotes ADD COLUMN bill_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_address_1') THEN
    ALTER TABLE quotes ADD COLUMN bill_address_1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_address_2') THEN
    ALTER TABLE quotes ADD COLUMN bill_address_2 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_city') THEN
    ALTER TABLE quotes ADD COLUMN bill_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_state') THEN
    ALTER TABLE quotes ADD COLUMN bill_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_zip') THEN
    ALTER TABLE quotes ADD COLUMN bill_zip text;
  END IF;
END $$;

-- Add shipping address fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_company') THEN
    ALTER TABLE quotes ADD COLUMN ship_company text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_name') THEN
    ALTER TABLE quotes ADD COLUMN ship_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_address_1') THEN
    ALTER TABLE quotes ADD COLUMN ship_address_1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_address_2') THEN
    ALTER TABLE quotes ADD COLUMN ship_address_2 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_city') THEN
    ALTER TABLE quotes ADD COLUMN ship_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_state') THEN
    ALTER TABLE quotes ADD COLUMN ship_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_zip') THEN
    ALTER TABLE quotes ADD COLUMN ship_zip text;
  END IF;
END $$;

-- Add date fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'created_date') THEN
    ALTER TABLE quotes ADD COLUMN created_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'production_due_date') THEN
    ALTER TABLE quotes ADD COLUMN production_due_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'customer_due_date') THEN
    ALTER TABLE quotes ADD COLUMN customer_due_date date;
  END IF;
END $$;

-- Add note fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'nickname') THEN
    ALTER TABLE quotes ADD COLUMN nickname text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'production_notes') THEN
    ALTER TABLE quotes ADD COLUMN production_notes text;
  END IF;
END $$;

-- Make customer_name nullable (it's required in original schema but not always available)
DO $$
BEGIN
  ALTER TABLE quotes ALTER COLUMN customer_name DROP NOT NULL;
END $$;

-- Add fields to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'taxed') THEN
    ALTER TABLE quote_line_items ADD COLUMN taxed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'sort_order') THEN
    ALTER TABLE quote_line_items ADD COLUMN sort_order int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'total_quantity') THEN
    ALTER TABLE quote_line_items ADD COLUMN total_quantity int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'total_price') THEN
    ALTER TABLE quote_line_items ADD COLUMN total_price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add index for sort_order
CREATE INDEX IF NOT EXISTS idx_quote_line_items_sort_order ON quote_line_items(quote_id, sort_order);
