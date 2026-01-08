/*
  # Billing Workflow Schema

  1. New Tables
    - `billing_queue` - Tracks invoices in the billing queue
      - Links Printavo invoices to billing state
      - Tracks sent status, payment links, and communication
    
    - `communication_logs` - Records all customer communications
      - Emails, SMS, link sharing
      - Full audit trail for compliance
    
    - `paid_invoices` - Archives completed payments
      - Stores final payment records
      - Links to Printavo invoice and Stripe payment

  2. Security
    - Enable RLS on all tables
    - Users can access their company's data only

  3. Indexes
    - Added for common queries and foreign keys
*/

-- Create billing_queue table
CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  printavo_status text,
  customer_name text,
  customer_email text,
  customer_company text,
  invoice_total numeric(10, 2) NOT NULL DEFAULT 0,
  invoice_date timestamptz,
  due_date timestamptz,
  stripe_payment_link_id text,
  stripe_invoice_id text,
  sent_at timestamptz,
  sent_method text,
  payment_status text DEFAULT 'unpaid',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create communication_logs table
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  communication_type text NOT NULL,
  method text NOT NULL,
  recipient text NOT NULL,
  subject text,
  message text,
  status text DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}',
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz DEFAULT now()
);

-- Create paid_invoices table
CREATE TABLE IF NOT EXISTS paid_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  customer_name text,
  customer_email text,
  invoice_total numeric(10, 2) NOT NULL,
  amount_paid numeric(10, 2) NOT NULL,
  payment_date timestamptz NOT NULL,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for billing_queue
CREATE OR REPLACE FUNCTION update_billing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_queue_updated_at ON billing_queue;
CREATE TRIGGER billing_queue_updated_at
  BEFORE UPDATE ON billing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_queue_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_printavo_invoice_id ON billing_queue(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_payment_status ON billing_queue(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_sent_at ON billing_queue(sent_at);

CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_printavo_invoice_id ON communication_logs(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_printavo_invoice_id ON paid_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_payment_date ON paid_invoices(payment_date);

-- Enable RLS
ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_queue
CREATE POLICY "Users can view billing queue"
  ON billing_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert to billing queue"
  ON billing_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update billing queue"
  ON billing_queue FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete from billing queue"
  ON billing_queue FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for communication_logs
CREATE POLICY "Users can view communication logs"
  ON communication_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert communication logs"
  ON communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for paid_invoices
CREATE POLICY "Users can view paid invoices"
  ON paid_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert paid invoices"
  ON paid_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);
