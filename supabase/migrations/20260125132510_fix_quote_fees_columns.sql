/*
  # Fix Quote Fees Table Columns

  1. Purpose
    - Add missing columns to quote_fees table that QuoteBuilder expects
    - Align column names with QuoteBuilder component expectations

  2. Changes to `quote_fees` table
    - Add `description` as alias/additional field to `fee_description`
    - Add `quantity` field (default 1)
    - Add `unit_amount` field
    - Add `total_amount` field
    - Add `taxed` field as alias to `is_taxed`

  3. Security
    - No RLS changes needed (already secured)
*/

-- Add missing columns to quote_fees
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'description') THEN
    ALTER TABLE quote_fees ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'quantity') THEN
    ALTER TABLE quote_fees ADD COLUMN quantity int DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'unit_amount') THEN
    ALTER TABLE quote_fees ADD COLUMN unit_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'total_amount') THEN
    ALTER TABLE quote_fees ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'taxed') THEN
    ALTER TABLE quote_fees ADD COLUMN taxed boolean DEFAULT false;
  END IF;
END $$;

-- Sync existing data to new fields
UPDATE quote_fees
SET 
  description = COALESCE(fee_description, ''),
  unit_amount = amount,
  total_amount = amount * COALESCE(quantity, 1),
  taxed = is_taxed
WHERE description IS NULL OR unit_amount IS NULL OR total_amount IS NULL;
