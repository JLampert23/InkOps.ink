/*
  # Create Printavo Data Cache Tables

  1. New Tables
    - `printavo_invoices`
      - Stores all invoice data from Printavo
      - Includes customer info, amounts, status, dates
      - Primary key: `id` (text, matches Printavo invoice ID)
    
    - `printavo_payments`
      - Stores all payment/transaction data from Printavo
      - Links to invoices via `invoice_id`
      - Includes payment method, amount, dates
      - Primary key: `id` (text, matches Printavo transaction ID)
    
    - `printavo_sync_log`
      - Tracks sync operations
      - Records last sync time and status
      - Helps prevent duplicate syncs

  2. Security
    - Enable RLS on all tables
    - Allow public read access (data is not sensitive)
    - Restrict write access to service role only

  3. Indexes
    - Add indexes on frequently queried fields
    - Customer email, status, dates for fast filtering
*/

-- Create invoices cache table
CREATE TABLE IF NOT EXISTS printavo_invoices (
  id text PRIMARY KEY,
  order_id text,
  invoice_number text,
  customer_email text,
  customer_name text,
  customer_company text,
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  amount_outstanding numeric DEFAULT 0,
  status text,
  invoice_date timestamptz,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_data jsonb
);

-- Create payments cache table
CREATE TABLE IF NOT EXISTS printavo_payments (
  id text PRIMARY KEY,
  invoice_id text,
  amount numeric DEFAULT 0,
  payment_method text,
  notes text,
  payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_data jsonb
);

-- Create sync log table
CREATE TABLE IF NOT EXISTS printavo_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'running',
  records_synced integer DEFAULT 0,
  error_message text
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON printavo_invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON printavo_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON printavo_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON printavo_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_outstanding ON printavo_invoices(amount_outstanding);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON printavo_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON printavo_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON printavo_sync_log(started_at DESC);

-- Enable RLS
ALTER TABLE printavo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_sync_log ENABLE ROW LEVEL SECURITY;

-- Allow public read access (this is business data, not sensitive user data)
CREATE POLICY "Allow public read access to invoices"
  ON printavo_invoices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to payments"
  ON printavo_payments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to sync log"
  ON printavo_sync_log FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role can write (edge functions will use this)
CREATE POLICY "Service role can insert invoices"
  ON printavo_invoices FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update invoices"
  ON printavo_invoices FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete invoices"
  ON printavo_invoices FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert payments"
  ON printavo_payments FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update payments"
  ON printavo_payments FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete payments"
  ON printavo_payments FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert sync log"
  ON printavo_sync_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update sync log"
  ON printavo_sync_log FOR UPDATE
  TO service_role
  USING (true);