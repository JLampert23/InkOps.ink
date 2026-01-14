/*
  # Add Manual Payment Entry Fields

  1. Changes to `payments` table
    - Add `payment_type` field to distinguish between Cash, Card, Check, etc.
    - Add `check_number` field for check payments
    - Add `created_by` field to track who created the payment
    - Add `source` field to distinguish manual vs. automated payments
  
  2. Notes
    - All fields are optional to maintain compatibility with Stripe payments
    - Source defaults to 'manual' for manually entered payments
*/

-- Add new columns to payments table
DO $$ 
BEGIN
  -- Add payment_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type text;
  END IF;

  -- Add check_number column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'check_number'
  ) THEN
    ALTER TABLE payments ADD COLUMN check_number text;
  END IF;

  -- Add created_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  -- Add source column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'source'
  ) THEN
    ALTER TABLE payments ADD COLUMN source text DEFAULT 'manual';
  END IF;
END $$;

-- Add check constraint for payment_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_payment_type'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT valid_payment_type 
    CHECK (payment_type IS NULL OR payment_type IN ('cash', 'debit_credit', 'check_ach', 'stripe', 'other'));
  END IF;
END $$;

-- Add check constraint for source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_payment_source'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT valid_payment_source 
    CHECK (source IN ('manual', 'stripe', 'square', 'printavo', 'other'));
  END IF;
END $$;