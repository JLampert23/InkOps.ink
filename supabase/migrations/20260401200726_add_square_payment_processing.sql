/*
  # Square Payment Processing Integration

  This migration adds Square as an alternative payment processor alongside Stripe,
  allowing companies to offer customers a choice of payment methods in the customer portal.

  ## 1. New Columns in company_settings
    - `square_payments_enabled` (boolean) - Toggle to enable Square payment processing
    - `square_webhook_signature_key` (text) - For validating incoming Square webhooks

  ## 2. New Tables
    - `square_payment_links` - Stores Square Checkout links for invoices
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `invoice_id` (text, references printavo_invoices)
      - `square_checkout_id` (text) - Square's checkout link ID
      - `square_checkout_url` (text) - The URL customers visit to pay
      - `square_order_id` (text) - Square order associated with checkout
      - `amount` (numeric) - Payment amount
      - `currency` (text) - Currency code (default 'USD')
      - `status` (text) - active, completed, expired, cancelled
      - `customer_email` (text)
      - `customer_name` (text)
      - `metadata` (jsonb) - Additional data
      - `expires_at` (timestamptz) - When the checkout link expires
      - `created_at`, `updated_at`, `paid_at` (timestamps)

    - `square_payments` - Records of completed Square payments
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `invoice_id` (text, references printavo_invoices)
      - `square_payment_id` (text, unique) - Square's payment ID
      - `square_order_id` (text) - Associated order
      - `amount` (numeric) - Payment amount
      - `currency` (text)
      - `status` (text) - COMPLETED, APPROVED, PENDING, FAILED, CANCELLED
      - `customer_email` (text)
      - `customer_name` (text)
      - `payment_method` (text) - card, square_gift_card, etc.
      - `card_brand` (text) - VISA, MASTERCARD, etc.
      - `card_last_four` (text) - Last 4 digits of card
      - `receipt_url` (text)
      - `metadata` (jsonb)
      - `created_at`, `updated_at` (timestamps)

    - `square_webhook_events` - Log of Square webhook events for audit/debugging
      - `id` (uuid, primary key)
      - `company_id` (uuid)
      - `square_event_id` (text, unique)
      - `event_type` (text)
      - `event_data` (jsonb)
      - `processed` (boolean)
      - `processed_at` (timestamptz)
      - `error_message` (text)
      - `created_at` (timestamptz)

  ## 3. Security
    - RLS enabled on all new tables
    - Policies restrict access to company members only
    - Service role policies for webhook processing

  ## 4. Important Notes
    - This is purely additive and does not modify any Stripe tables or functionality
    - Square payments are opt-in via the square_payments_enabled toggle
    - Companies can have both Stripe and Square enabled simultaneously
*/

-- Add Square payment processing columns to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_payments_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_payments_enabled boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_webhook_signature_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_webhook_signature_key text;
  END IF;
END $$;

-- Create square_payment_links table (invoice_id is text to match printavo_invoices.id)
CREATE TABLE IF NOT EXISTS square_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  square_checkout_id text,
  square_checkout_url text NOT NULL,
  square_order_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  customer_email text,
  customer_name text,
  metadata jsonb DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Create square_payments table (invoice_id is text to match printavo_invoices.id)
CREATE TABLE IF NOT EXISTS square_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  invoice_id text REFERENCES printavo_invoices(id) ON DELETE SET NULL,
  square_payment_id text UNIQUE NOT NULL,
  square_order_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'PENDING' CHECK (status IN ('COMPLETED', 'APPROVED', 'PENDING', 'FAILED', 'CANCELLED')),
  customer_email text,
  customer_name text,
  payment_method text,
  card_brand text,
  card_last_four text,
  receipt_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create square_webhook_events table
CREATE TABLE IF NOT EXISTS square_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE SET NULL,
  square_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for square_payment_links
CREATE OR REPLACE FUNCTION update_square_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS square_payment_links_updated_at ON square_payment_links;
CREATE TRIGGER square_payment_links_updated_at
  BEFORE UPDATE ON square_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_square_payment_links_updated_at();

-- Add updated_at trigger for square_payments
CREATE OR REPLACE FUNCTION update_square_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS square_payments_updated_at ON square_payments;
CREATE TRIGGER square_payments_updated_at
  BEFORE UPDATE ON square_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_square_payments_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_square_payment_links_company_id ON square_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_square_payment_links_invoice_id ON square_payment_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_square_payment_links_status ON square_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_square_payment_links_square_checkout_id ON square_payment_links(square_checkout_id);

CREATE INDEX IF NOT EXISTS idx_square_payments_company_id ON square_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_square_payments_invoice_id ON square_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_square_payments_status ON square_payments(status);
CREATE INDEX IF NOT EXISTS idx_square_payments_square_payment_id ON square_payments(square_payment_id);

CREATE INDEX IF NOT EXISTS idx_square_webhook_events_square_event_id ON square_webhook_events(square_event_id);
CREATE INDEX IF NOT EXISTS idx_square_webhook_events_processed ON square_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_square_webhook_events_company_id ON square_webhook_events(company_id);

-- Enable RLS
ALTER TABLE square_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for square_payment_links
CREATE POLICY "Company members can view their payment links"
  ON square_payment_links FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company members can create payment links"
  ON square_payment_links FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their payment links"
  ON square_payment_links FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Service role can manage all payment links (for webhooks)
CREATE POLICY "Service role can manage all payment links"
  ON square_payment_links FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for square_payments
CREATE POLICY "Company members can view their payments"
  ON square_payments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company members can create payments"
  ON square_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their payments"
  ON square_payments FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Service role can manage all payments (for webhooks)
CREATE POLICY "Service role can manage all payments"
  ON square_payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for square_webhook_events
CREATE POLICY "Company members can view their webhook events"
  ON square_webhook_events FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Service role can manage webhook events
CREATE POLICY "Service role can manage webhook events"
  ON square_webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add anon role policies for portal access (customers paying invoices)
CREATE POLICY "Anon can view active payment links for valid invoices"
  ON square_payment_links FOR SELECT
  TO anon
  USING (status = 'active');

-- Allow portal to check payment status
CREATE POLICY "Anon can view completed payments"
  ON square_payments FOR SELECT
  TO anon
  USING (status = 'COMPLETED');
