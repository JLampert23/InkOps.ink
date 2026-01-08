/*
  # Add Stripe Invoice and Partial Payment Support

  ## New Tables
  
  ### `stripe_invoices`
  Tracks Stripe invoices created for Printavo invoices with minimum payment support
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to company_settings)
  - `printavo_invoice_id` (text, Printavo invoice ID)
  - `stripe_invoice_id` (text, unique, Stripe invoice ID)
  - `stripe_customer_id` (text, Stripe customer ID)
  - `hosted_invoice_url` (text, customer-facing URL)
  - `invoice_pdf_url` (text, PDF URL)
  - `total_amount` (numeric, total invoice amount in cents)
  - `minimum_due_amount` (numeric, minimum payment required in cents)
  - `amount_paid` (numeric, total amount paid in cents, default 0)
  - `amount_remaining` (numeric, remaining balance in cents)
  - `currency` (text, default 'usd')
  - `status` (text, Stripe invoice status: draft, open, paid, void, uncollectible)
  - `customer_email` (text)
  - `customer_name` (text)
  - `description` (text)
  - `metadata` (jsonb, additional Printavo data)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `paid_at` (timestamptz, nullable)

  ### `stripe_payment_history`
  Tracks all payments made against Stripe invoices (supports partial payments)
  - `id` (uuid, primary key)
  - `stripe_invoice_id` (uuid, foreign key to stripe_invoices)
  - `payment_intent_id` (text, Stripe payment intent ID)
  - `charge_id` (text, Stripe charge ID)
  - `amount` (numeric, payment amount in cents)
  - `currency` (text, default 'usd')
  - `status` (text, succeeded, failed, canceled)
  - `payment_method` (text, card, bank_transfer, etc.)
  - `receipt_url` (text, Stripe receipt URL)
  - `created_at` (timestamptz)
  - `metadata` (jsonb)

  ## Security
  - Enable RLS on both tables
  - Add policies for authenticated users to access data

  ## Notes
  - Supports 50% minimum payment requirement
  - Tracks partial and full payments
  - Stripe handles payment collection and balance tracking
*/

-- Create stripe_invoices table
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  stripe_invoice_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  hosted_invoice_url text NOT NULL,
  invoice_pdf_url text,
  total_amount numeric NOT NULL,
  minimum_due_amount numeric NOT NULL,
  amount_paid numeric DEFAULT 0 NOT NULL,
  amount_remaining numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  customer_email text,
  customer_name text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz,
  CONSTRAINT valid_amounts CHECK (amount_paid >= 0 AND amount_remaining >= 0 AND total_amount > 0),
  CONSTRAINT valid_minimum CHECK (minimum_due_amount >= 0 AND minimum_due_amount <= total_amount)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_printavo_id ON stripe_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON stripe_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_stripe_id ON stripe_invoices(stripe_invoice_id);

-- Create stripe_payment_history table
CREATE TABLE IF NOT EXISTS stripe_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id uuid NOT NULL REFERENCES stripe_invoices(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL,
  charge_id text,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'succeeded' NOT NULL,
  payment_method text,
  receipt_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Create indexes for payment history
CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON stripe_payment_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_intent ON stripe_payment_history(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON stripe_payment_history(created_at DESC);

-- Enable RLS
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_invoices
-- Following the existing company_settings pattern where all authenticated users have access

CREATE POLICY "Authenticated users can view stripe invoices"
  ON stripe_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create stripe invoices"
  ON stripe_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stripe invoices"
  ON stripe_invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for stripe_payment_history

CREATE POLICY "Authenticated users can view payment history"
  ON stripe_payment_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payment history"
  ON stripe_payment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stripe_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on stripe_invoices
DROP TRIGGER IF EXISTS trigger_update_stripe_invoice_timestamp ON stripe_invoices;
CREATE TRIGGER trigger_update_stripe_invoice_timestamp
  BEFORE UPDATE ON stripe_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_invoice_updated_at();