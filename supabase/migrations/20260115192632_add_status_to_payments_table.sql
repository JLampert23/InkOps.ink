/*
  # Add status field to payments table for unified payment tracking

  1. Changes
    - Add `status` field to track payment status (successful, failed, refunded, pending)
    - Add `refund_amount` field to track partial/full refunds
    - Add `refunded_at` timestamp field
    - Add `refund_reason` text field
    - Add index on status for faster queries
    - Add index on source for faster queries

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$ 
BEGIN
  -- Add status field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN status text DEFAULT 'successful' 
    CHECK (status IN ('successful', 'failed', 'refunded', 'pending', 'partial_refund'));
  END IF;

  -- Add refund_amount field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'refund_amount'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN refund_amount numeric DEFAULT 0;
  END IF;

  -- Add refunded_at field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN refunded_at timestamptz;
  END IF;

  -- Add refund_reason field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN refund_reason text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);