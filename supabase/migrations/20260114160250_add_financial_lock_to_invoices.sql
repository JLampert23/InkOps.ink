/*
  # Add Financial Lock Protection to Invoices

  ## Summary
  This migration adds financial lock protection to prevent Printavo sync from 
  overwriting payment data that has been recorded in our system (Stripe, manual 
  payments, credits, etc.).

  ## Changes

  1. **New Fields Added to `printavo_invoices`**
     - `is_financially_locked` (boolean) - Prevents sync from overwriting financial data
     - `locked_at` (timestamptz) - Timestamp when lock was applied
     - `locked_by` (text) - Source that locked it ('stripe', 'manual', 'system')
     - `balance_remaining` (numeric) - Our calculated balance (not from Printavo)

  2. **Protected Fields (When Locked)**
     When `is_financially_locked = true`, sync will NOT overwrite:
     - `amount_paid` (our payment tracking)
     - `amount_outstanding` (our balance calculation)
     - `balance_remaining` (our balance tracking)
     - `status` (our status based on payments)
     - `status_stage` (our workflow stage)

  3. **Safe Fields (Always Updated)**
     Even when locked, sync CAN update:
     - Customer info (name, email, phone, company)
     - Addresses (billing/shipping)
     - Invoice amounts (subtotal, tax, total) - allows quantity changes
     - Dates (invoice_date, due_date)
     - Metadata (raw_data)

  4. **Auto-Lock Existing Paid Invoices**
     - Any invoice with status = 'Paid' will be automatically locked
     - Any invoice with status_stage = 'paid' will be automatically locked
     - Locked by 'system' during migration

  ## Security
  - No RLS changes needed (uses existing policies)

  ## Notes
  - Lock is set when invoices are paid IN FULL via Stripe
  - Lock is NOT set on partial payments (balance still owed)
  - Admins can manually unlock if needed
  - Printavo data is still stored in raw_data for audit trail
*/

-- Add balance_remaining field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'balance_remaining'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN balance_remaining numeric DEFAULT 0;
  END IF;
END $$;

-- Add is_financially_locked field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'is_financially_locked'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN is_financially_locked boolean DEFAULT false;
  END IF;
END $$;

-- Add locked_at field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN locked_at timestamptz;
  END IF;
END $$;

-- Add locked_by field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'locked_by'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN locked_by text;
  END IF;
END $$;

-- Create index on is_financially_locked for efficient queries
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_financially_locked 
ON printavo_invoices(is_financially_locked) 
WHERE is_financially_locked = true;

-- Auto-lock existing paid invoices
UPDATE printavo_invoices
SET 
  is_financially_locked = true,
  locked_at = COALESCE(updated_at, created_at, now()),
  locked_by = 'system'
WHERE 
  (status = 'Paid' OR status_stage = 'paid')
  AND (is_financially_locked IS NULL OR is_financially_locked = false);

-- Initialize balance_remaining for existing invoices
UPDATE printavo_invoices
SET balance_remaining = COALESCE(amount_outstanding, total - COALESCE(amount_paid, 0))
WHERE balance_remaining IS NULL OR balance_remaining = 0;