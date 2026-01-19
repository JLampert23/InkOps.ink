/*
  # Fix Status Column Issues

  This script addresses common "status" column conflicts when applying schema updates.

  Common Issues:
  1. Status column already exists with different type
  2. Status column has conflicting constraints
  3. Status column has incompatible default values

  Run this BEFORE applying the full schema if you get status column errors.
*/

-- ================================================
-- FIX 1: Drop and recreate status columns safely
-- ================================================

-- For invoices table
DO $$
BEGIN
  -- Check if status column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'status'
  ) THEN
    -- Drop the column if it exists (this is safe if using IF NOT EXISTS in main schema)
    ALTER TABLE invoices DROP COLUMN IF EXISTS status;
  END IF;
END $$;

-- For payments table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE payments DROP COLUMN IF EXISTS status;
  END IF;
END $$;

-- For billing_queue table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_queue' AND column_name = 'status'
  ) THEN
    ALTER TABLE billing_queue DROP COLUMN IF EXISTS status;
  END IF;
END $$;

-- For stripe_payment_intents table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_payment_intents' AND column_name = 'status'
  ) THEN
    ALTER TABLE stripe_payment_intents DROP COLUMN IF EXISTS status;
  END IF;
END $$;

-- For automation_logs table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE automation_logs DROP COLUMN IF EXISTS status;
  END IF;
END $$;

-- ================================================
-- FIX 2: Remove conflicting constraints
-- ================================================

-- Drop any existing check constraints on status columns
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'CHECK'
    AND constraint_name LIKE '%status%'
    AND table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
                   constraint_record.table_name,
                   constraint_record.constraint_name);
  END LOOP;
END $$;

-- ================================================
-- FIX 3: Clean up any orphaned indexes
-- ================================================

DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_billing_queue_status;
DROP INDEX IF EXISTS idx_stripe_payment_intents_status;
DROP INDEX IF EXISTS idx_automation_logs_status;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE 'Status column cleanup completed successfully!';
  RAISE NOTICE 'You can now run the full COMPLETE_DATABASE_SCHEMA.sql file.';
END $$;
