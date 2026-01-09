/*
  # Update Accounting Workflow Schema

  ## Description
  This migration updates the database schema to support the complete accounting workflow:
  - Customers are created automatically when invoices are synced
  - Invoices start in billing_queue, move to accounts_receivable when payment links are sent
  - Payments are tracked in a unified payments table
  - Invoices move to paid status when fully paid

  ## Changes

  1. **Customers Table Updates**
    - Add `billing_address` (jsonb) - billing address from Printavo
    - Add `shipping_address` (jsonb) - shipping address from Printavo

  2. **Printavo Invoices Updates**
    - Update status_stage values to match workflow
    - Add billing_address and shipping_address columns
    - Add date_sent field to track when payment link was sent
    - Add payment_link field to store the Stripe payment link

  3. **Payments Table** (NEW)
    - Track all payments received (Stripe and future payment methods)
    - Link to invoice and customer
    - Store payment method, amount, date, transaction details

  ## Status Stage Workflow
  - `billing_queue`: New invoices waiting for payment links to be sent
  - `accounts_receivable`: Payment link sent, awaiting payment
  - `paid`: Invoice fully paid (amount_outstanding = 0)
*/

-- Update customers table to add address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE customers ADD COLUMN billing_address jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE customers ADD COLUMN shipping_address jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update printavo_invoices table
DO $$
BEGIN
  -- Add billing_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add shipping_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add date_sent to track when payment link was sent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'date_sent'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN date_sent timestamptz;
  END IF;

  -- Add payment_link to store Stripe payment link URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'payment_link'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN payment_link text;
  END IF;

  -- Update status_stage constraint to only allow our three workflow stages
  ALTER TABLE printavo_invoices DROP CONSTRAINT IF EXISTS printavo_invoices_status_stage_check;
  ALTER TABLE printavo_invoices ADD CONSTRAINT printavo_invoices_status_stage_check
    CHECK (status_stage IN ('billing_queue', 'accounts_receivable', 'paid'));
END $$;

-- Create payments table to track all payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_date timestamptz DEFAULT now() NOT NULL,
  payment_method text,
  stripe_transaction_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  receipt_url text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Create indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);

-- Enable RLS for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on payments
DROP TRIGGER IF EXISTS trigger_update_payment_timestamp ON payments;
CREATE TRIGGER trigger_update_payment_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_updated_at();

-- Create index on status_stage for workflow queries
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_workflow 
  ON printavo_invoices(status_stage, amount_outstanding) 
  WHERE status_stage IN ('billing_queue', 'accounts_receivable');

-- Update all existing invoices to have correct status_stage based on balance
UPDATE printavo_invoices
SET status_stage = CASE
  WHEN amount_outstanding = 0 THEN 'paid'
  WHEN date_sent IS NOT NULL OR payment_link IS NOT NULL THEN 'accounts_receivable'
  ELSE 'billing_queue'
END
WHERE status_stage NOT IN ('billing_queue', 'accounts_receivable', 'paid')
   OR status_stage IS NULL;