-- =============================================================================
-- SAFE PRODUCTION DATABASE SETUP - Run in order
-- =============================================================================
-- This script creates everything from scratch safely
-- Run each section one at a time if needed
-- =============================================================================

-- =============================================================================
-- STEP 1: Core Company Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  printavo_email TEXT,
  printavo_password TEXT,
  square_access_token TEXT,
  square_location_id TEXT,
  resend_api_key TEXT,
  email_from_address TEXT,
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT,
  invoice_statuses TEXT[] DEFAULT ARRAY['open', 'pending'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'finance', 'production', 'user')),
  unlock_pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 2: Customers Table (needed before other tables reference it)
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  printavo_customer_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 3: Printavo Tables (create from scratch)
-- =============================================================================

CREATE TABLE IF NOT EXISTS printavo_invoices (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number TEXT,
  customer_name TEXT,
  customer_id uuid REFERENCES customers(id),
  customer_email TEXT,
  customer_phone TEXT,
  customer_company TEXT,
  customer_address TEXT,
  customer_city TEXT,
  customer_state TEXT,
  customer_zip TEXT,
  status TEXT,
  status_stage TEXT,
  due_date DATE,
  formatted_due_date TEXT,
  total NUMERIC,
  amount_paid NUMERIC DEFAULT 0,
  amount_outstanding NUMERIC,
  balance_remaining NUMERIC,
  tax NUMERIC,
  discount NUMERIC,
  notes TEXT,
  order_id TEXT,
  quote_id TEXT,
  production_notes TEXT,
  created_at TIMESTAMPTZ,
  formatted_created_at TEXT,
  company_name TEXT,
  company_logo_url TEXT,
  company_logo_base64 TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip TEXT,
  company_phone TEXT,
  company_email TEXT,
  financially_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by uuid REFERENCES auth.users(id),
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS printavo_line_items (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  quantity INTEGER,
  price NUMERIC,
  total NUMERIC,
  style_name TEXT,
  style_number TEXT,
  color_name TEXT,
  size_name TEXT,
  product_name TEXT,
  category_name TEXT,
  task_name TEXT,
  decoration_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS printavo_payments (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  amount NUMERIC,
  payment_type TEXT,
  payment_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 4: Unified Payments Table (matches edge function requirements)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  customer_id uuid REFERENCES customers(id),
  amount NUMERIC NOT NULL CHECK (amount <> 0),
  payment_type TEXT,
  payment_method TEXT NOT NULL,
  check_number TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('printavo', 'stripe', 'manual')),
  source_payment_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reversed')),
  created_by uuid REFERENCES auth.users(id),
  recorded_by uuid REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 5: Automation & Reporting Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS automated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  schedule_frequency TEXT NOT NULL,
  schedule_time TIME,
  schedule_day_of_week INTEGER,
  schedule_day_of_month INTEGER,
  schedule_timezone TEXT DEFAULT 'America/New_York',
  recipient_emails TEXT[] NOT NULL,
  filters JSONB,
  enabled BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL,
  conditions JSONB,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
  trigger_data JSONB,
  actions_taken JSONB,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 6: Stripe Integration Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT NOT NULL,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  amount_due NUMERIC,
  total_amount NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  amount_remaining NUMERIC NOT NULL,
  status TEXT NOT NULL,
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 7: Billing Queue Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT NOT NULL,
  customer_id uuid REFERENCES customers(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'failed', 'skipped')),
  payment_status TEXT,
  send_method TEXT CHECK (send_method IN ('email', 'sms', 'both')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  queue_item_id uuid REFERENCES billing_queue(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT,
  communication_type TEXT NOT NULL,
  method TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  message TEXT,
  status TEXT NOT NULL,
  metadata JSONB,
  sent_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 8: Create Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_printavo_invoices_company_id ON printavo_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id ON printavo_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_company_id ON printavo_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_invoice_id ON printavo_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_invoice_id ON printavo_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_invoice_id ON billing_queue(printavo_invoice_id);

-- =============================================================================
-- STEP 9: Enable Row Level Security
-- =============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 10: Create RLS Policies (drop existing first to avoid conflicts)
-- =============================================================================

-- Companies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Company settings
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
CREATE POLICY "Users can view their company settings" ON company_settings
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update their company settings" ON company_settings;
CREATE POLICY "Admins can update their company settings" ON company_settings
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

-- User profiles
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
CREATE POLICY "Users can view profiles in their company" ON user_profiles
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Printavo invoices
DROP POLICY IF EXISTS "Users can view invoices from their company" ON printavo_invoices;
CREATE POLICY "Users can view invoices from their company" ON printavo_invoices
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update invoices from their company" ON printavo_invoices;
CREATE POLICY "Users can update invoices from their company" ON printavo_invoices
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Printavo line items
DROP POLICY IF EXISTS "Users can view line items from their company" ON printavo_line_items;
CREATE POLICY "Users can view line items from their company" ON printavo_line_items
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Printavo payments
DROP POLICY IF EXISTS "Users can view printavo payments from their company" ON printavo_payments;
CREATE POLICY "Users can view printavo payments from their company" ON printavo_payments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Customers
DROP POLICY IF EXISTS "Users can view customers from their company" ON customers;
CREATE POLICY "Users can view customers from their company" ON customers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert customers for their company" ON customers;
CREATE POLICY "Users can insert customers for their company" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Payments
DROP POLICY IF EXISTS "Users can view payments from their company" ON payments;
CREATE POLICY "Users can view payments from their company" ON payments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert payments for their company" ON payments;
CREATE POLICY "Users can insert payments for their company" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update payments for their company" ON payments;
CREATE POLICY "Users can update payments for their company" ON payments
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Finance users can delete payments for their company" ON payments;
CREATE POLICY "Finance users can delete payments for their company" ON payments
  FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'finance'))
  );

-- Billing queue
DROP POLICY IF EXISTS "Users can view billing queue from their company" ON billing_queue;
CREATE POLICY "Users can view billing queue from their company" ON billing_queue
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage billing queue for their company" ON billing_queue;
CREATE POLICY "Users can manage billing queue for their company" ON billing_queue
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Communication logs
DROP POLICY IF EXISTS "Users can view communication logs from their company" ON communication_logs;
CREATE POLICY "Users can view communication logs from their company" ON communication_logs
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert communication logs for their company" ON communication_logs;
CREATE POLICY "Users can insert communication logs for their company" ON communication_logs
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- =============================================================================
-- STEP 11: Create Signup Trigger Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- Create a new company for this user
  INSERT INTO companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  RETURNING id INTO new_company_id;

  -- Create company settings
  INSERT INTO company_settings (company_id)
  VALUES (new_company_id);

  -- Create user profile with super_admin role
  INSERT INTO user_profiles (id, company_id, email, full_name, role)
  VALUES (
    NEW.id,
    new_company_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'super_admin'
  );

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
