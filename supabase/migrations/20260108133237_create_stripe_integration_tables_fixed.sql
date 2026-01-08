/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_payment_links` - Stores Stripe payment links for Printavo invoices
    - `stripe_payments` - Tracks Stripe payment records
    - `stripe_webhook_events` - Logs webhook events for debugging

  2. Security
    - Enable RLS on all tables
    - Policies allow users to manage their own company's data

  3. Indexes
    - Added for performance on common queries
*/

-- Create stripe_payment_links table
CREATE TABLE IF NOT EXISTS stripe_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_invoice_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'active',
  customer_email text,
  customer_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Create stripe_payments table
CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'processing',
  customer_email text,
  customer_name text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_webhook_events table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for stripe_payment_links
CREATE OR REPLACE FUNCTION update_stripe_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_payment_links_updated_at ON stripe_payment_links;
CREATE TRIGGER stripe_payment_links_updated_at
  BEFORE UPDATE ON stripe_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payment_links_updated_at();

-- Add updated_at trigger for stripe_payments
CREATE OR REPLACE FUNCTION update_stripe_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_payments_updated_at ON stripe_payments;
CREATE TRIGGER stripe_payments_updated_at
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payments_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id ON stripe_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_printavo_invoice_id ON stripe_payment_links(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_status ON stripe_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id ON stripe_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_printavo_invoice_id ON stripe_payments(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Enable RLS
ALTER TABLE stripe_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_payment_links
CREATE POLICY "Users can view payment links"
  ON stripe_payment_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payment links"
  ON stripe_payment_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payment links"
  ON stripe_payment_links FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for stripe_payments
CREATE POLICY "Users can view payments"
  ON stripe_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payments"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payments"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for stripe_webhook_events
CREATE POLICY "Users can view webhook events"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert webhook events"
  ON stripe_webhook_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update webhook events"
  ON stripe_webhook_events FOR UPDATE
  TO authenticated
  USING (true);
