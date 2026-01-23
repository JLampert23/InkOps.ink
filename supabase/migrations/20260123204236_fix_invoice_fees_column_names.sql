/*
  # Fix Invoice Fees Table Column Names

  1. Changes
    - Rename `name` column to `fee_name` to match application code
    - Update `amount_type` default from 'fixed' to 'dollar' to match application logic
    - Update CHECK constraint for amount_type to accept 'dollar' and 'percent'

  2. Rationale
    - Application code expects `fee_name` column
    - Application uses 'dollar' and 'percent' as amount_type values
*/

-- Rename name column to fee_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_fees' AND column_name = 'name'
  ) THEN
    ALTER TABLE invoice_fees RENAME COLUMN name TO fee_name;
  END IF;
END $$;

-- Drop old constraint and add new one for amount_type
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invoice_fees' AND constraint_name LIKE '%amount_type%'
  ) THEN
    ALTER TABLE invoice_fees DROP CONSTRAINT IF EXISTS invoice_fees_amount_type_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE invoice_fees ADD CONSTRAINT invoice_fees_amount_type_check 
    CHECK (amount_type IN ('dollar', 'percent'));
END $$;

-- Update default value for amount_type
ALTER TABLE invoice_fees ALTER COLUMN amount_type SET DEFAULT 'dollar';

-- Update any existing rows with 'fixed' to 'dollar'
UPDATE invoice_fees SET amount_type = 'dollar' WHERE amount_type = 'fixed';
