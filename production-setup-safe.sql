-- =============================================================================
-- PRODUCTION DATABASE SETUP - SAFE IDEMPOTENT VERSION
-- =============================================================================
-- This script can be run multiple times safely
-- It checks for existing objects before creating them
-- Run this in your production Supabase SQL Editor
-- Project: erpbkhkwxsbmmbhkvulu.supabase.co
-- =============================================================================

-- First, let's check what tables already exist
DO $$
BEGIN
  RAISE NOTICE 'Starting production database setup...';
  RAISE NOTICE 'Checking existing schema...';
END $$;

-- =============================================================================
-- STEP 1: Create tables that don't exist yet
-- =============================================================================

-- Printavo Cache Tables
CREATE TABLE IF NOT EXISTS printavo_invoices (
  id SERIAL PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  visual_id TEXT,
  ordernumber TEXT,
  customer_id TEXT,
  customername TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_company TEXT,
  formatted_subtotal TEXT,
  formatted_discount TEXT,
  formatted_tax TEXT,
  formatted_total TEXT,
  subtotal_cents BIGINT,
  discount_cents BIGINT,
  total_cents BIGINT,
  tax_cents BIGINT,
  formatted_total_payments TEXT,
  total_payments_cents BIGINT,
  balance_due NUMERIC(10,2) GENERATED ALWAYS AS ((total_cents - total_payments_cents)::numeric / 100) STORED,
  status TEXT,
  status_stage TEXT,
  order_status TEXT,
  notes TEXT,
  production_notes TEXT,
  created_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  nick TEXT,
  salesrep TEXT,
  formatted_due_date TEXT,
  quote_vs_order TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  financially_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by uuid REFERENCES auth.users(id),
  company_name TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_logo_url TEXT,
  company_logo_base64 TEXT
);

CREATE TABLE IF NOT EXISTS printavo_line_items (
  id SERIAL PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  line_item_id TEXT,
  product_name TEXT,
  quantity INTEGER,
  price_cents BIGINT,
  formatted_price TEXT,
  style_number TEXT,
  style_name TEXT,
  style_description TEXT,
  product_colors JSONB,
  total_garments INTEGER,
  garment_breakdown JSONB,
  decoration_details JSONB,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS printavo_payments (
  id SERIAL PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  payment_id TEXT,
  amount_cents BIGINT,
  formatted_amount TEXT,
  payment_date TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  customer_id uuid REFERENCES customers(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'failed', 'skipped')),
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

CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT NOT NULL,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  amount_due_cents BIGINT NOT NULL,
  amount_paid_cents BIGINT DEFAULT 0,
  amount_remaining_cents BIGINT NOT NULL,
  status TEXT NOT NULL,
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
  payment_date TIMESTAMPTZ NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reversed')),
  source TEXT NOT NULL CHECK (source IN ('printavo', 'stripe', 'manual')),
  source_payment_id TEXT,
  notes TEXT,
  recorded_by uuid REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ar_automation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_time TIME NOT NULL,
  schedule_day INTEGER,
  schedule_timezone TEXT DEFAULT 'America/New_York',
  recipient_emails TEXT[] NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ar_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES ar_automation_schedules(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  invoices_included INTEGER,
  total_amount_cents BIGINT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- STEP 2: Add columns that don't exist yet
-- =============================================================================

DO $$
BEGIN
  -- Add customer_id to invoices
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_id_fk') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_id_fk uuid REFERENCES customers(id);
  END IF;

  -- Add company_id columns if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_id') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'company_id') THEN
    ALTER TABLE printavo_line_items ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_payments' AND column_name = 'company_id') THEN
    ALTER TABLE printavo_payments ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- STEP 3: Create indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_printavo_invoices_invoice_id ON printavo_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id ON printavo_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_status ON printavo_invoices(status);
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_company_id ON printavo_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_invoice_id ON printavo_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_company_id ON printavo_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_invoice_id ON printavo_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);

-- =============================================================================
-- STEP 4: Enable Row Level Security
-- =============================================================================

ALTER TABLE printavo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_automation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_automation_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 5: Drop and recreate RLS policies (to ensure consistency)
-- =============================================================================

-- Companies policies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Company settings policies
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
CREATE POLICY "Users can view their company settings" ON company_settings
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
CREATE POLICY "Users can update their company settings" ON company_settings
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- User profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Printavo invoices policies
DROP POLICY IF EXISTS "Users can view invoices from their company" ON printavo_invoices;
CREATE POLICY "Users can view invoices from their company" ON printavo_invoices
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update invoices from their company" ON printavo_invoices;
CREATE POLICY "Users can update invoices from their company" ON printavo_invoices
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Printavo line items policies
DROP POLICY IF EXISTS "Users can view line items from their company" ON printavo_line_items;
CREATE POLICY "Users can view line items from their company" ON printavo_line_items
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Printavo payments policies
DROP POLICY IF EXISTS "Users can view payments from their company" ON printavo_payments;
CREATE POLICY "Users can view payments from their company" ON printavo_payments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Customers policies
DROP POLICY IF EXISTS "Users can view customers from their company" ON customers;
CREATE POLICY "Users can view customers from their company" ON customers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Payments policies
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

-- =============================================================================
-- STEP 6: Create functions and triggers
-- =============================================================================

-- Function to handle new user signup
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

-- Function to backfill customers from invoices
CREATE OR REPLACE FUNCTION backfill_customers_from_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO customers (company_id, printavo_customer_id, name, email, phone, company_name)
  SELECT DISTINCT ON (i.company_id, i.customer_id)
    i.company_id,
    i.customer_id,
    COALESCE(i.customername, 'Unknown Customer'),
    i.customer_email,
    i.customer_phone,
    i.customer_company
  FROM printavo_invoices i
  WHERE i.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM customers c
      WHERE c.company_id = i.company_id
        AND c.printavo_customer_id = i.customer_id
    )
  ON CONFLICT DO NOTHING;

  UPDATE printavo_invoices i
  SET customer_id_fk = c.id
  FROM customers c
  WHERE c.company_id = i.company_id
    AND c.printavo_customer_id = i.customer_id
    AND i.customer_id_fk IS NULL;
END;
$$;

-- Run the backfill
SELECT backfill_customers_from_invoices();

-- =============================================================================
-- STEP 7: Enable pg_cron extension
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Note: pg_cron jobs need to be created manually via Supabase dashboard
-- because they require specific permissions

-- =============================================================================
-- SETUP COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Production database setup complete!';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test signup at your live site';
  RAISE NOTICE '2. Configure API credentials in Account Settings';
  RAISE NOTICE '3. Run initial Printavo sync';
  RAISE NOTICE '=============================================================================';
END $$;
