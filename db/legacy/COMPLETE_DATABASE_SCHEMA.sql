-- =============================================================================
-- COMPLETE DATABASE SCHEMA - InkOps Platform
-- =============================================================================
-- This is a comprehensive, production-ready database schema that includes:
-- - Multi-tenant company isolation with RLS
-- - Printavo invoice and payment sync
-- - Stripe payment processing integration
-- - Customer management with contacts
-- - Automated reporting and workflows
-- - Billing queue and communication logs
-- - Full audit trail and security
-- =============================================================================

-- =============================================================================
-- SECTION 1: Core Company & User Tables
-- =============================================================================

-- Companies table (root of multi-tenant hierarchy)
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Company settings with all API credentials and configurations
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,

  -- Printavo Integration
  printavo_email TEXT,
  printavo_password TEXT,
  printavo_company_id TEXT,
  printavo_data JSONB,

  -- Square Integration
  square_access_token TEXT,
  square_location_id TEXT,

  -- Email Integration (Resend)
  resend_api_key TEXT,
  email_from_address TEXT,

  -- Stripe Integration
  stripe_secret_key TEXT,
  stripe_webhook_secret TEXT,

  -- Twilio SMS Integration
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT,

  -- Invoice Display Preferences
  invoice_statuses TEXT[] DEFAULT ARRAY['open', 'pending'],

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles linked to companies
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'finance', 'production', 'user')),
  unlock_pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SECTION 2: Customer Management
-- =============================================================================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,

  -- Company/Contact Info
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,

  -- Billing Address
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'USA',

  -- Shipping Address
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'USA',

  -- Additional Info
  customer_type TEXT DEFAULT 'business',
  tax_exempt BOOLEAN DEFAULT false,
  tax_id TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  credit_limit DECIMAL(10,2),

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Status
  status TEXT DEFAULT 'active',

  -- Audit fields
  created_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customer contacts (multiple contacts per customer)
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SECTION 3: Printavo Data Cache Tables
-- =============================================================================

-- Printavo invoices cache
CREATE TABLE IF NOT EXISTS printavo_invoices (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,

  -- Basic invoice info
  order_id TEXT,
  invoice_number TEXT,

  -- Customer information (denormalized from Printavo)
  customer_id uuid REFERENCES customers(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_company TEXT,
  customer_address TEXT,
  customer_city TEXT,
  customer_state TEXT,
  customer_zip TEXT,

  -- Financial data
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  amount_outstanding NUMERIC DEFAULT 0,
  balance_remaining NUMERIC,

  -- Status tracking
  status TEXT,
  status_stage TEXT,

  -- Dates
  invoice_date TIMESTAMPTZ,
  due_date DATE,
  formatted_due_date TEXT,
  formatted_created_at TEXT,

  -- Additional info
  notes TEXT,
  quote_id TEXT,
  production_notes TEXT,

  -- Company branding for invoice PDFs
  company_name TEXT,
  company_logo_url TEXT,
  company_logo_base64 TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip TEXT,
  company_phone TEXT,
  company_email TEXT,

  -- Financial locking (prevent changes after accounting)
  financially_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by uuid REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB
);

-- Printavo line items (invoice details)
CREATE TABLE IF NOT EXISTS printavo_line_items (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  invoice_id TEXT REFERENCES printavo_invoices(id) ON DELETE CASCADE NOT NULL,

  -- Item details
  name TEXT,
  description TEXT,
  quantity INTEGER,
  price NUMERIC,
  total NUMERIC,

  -- Product details
  style_name TEXT,
  style_number TEXT,
  color_name TEXT,
  size_name TEXT,
  product_name TEXT,
  category_name TEXT,
  task_name TEXT,
  decoration_name TEXT,

  -- Extracted garment metadata (parsed from description)
  extracted_style TEXT,
  extracted_color TEXT,
  extracted_sizes JSONB DEFAULT '{}'::jsonb,
  extracted_sku TEXT,
  extraction_notes TEXT,
  parsed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Printavo payments cache
CREATE TABLE IF NOT EXISTS printavo_payments (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  invoice_id TEXT REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  amount NUMERIC DEFAULT 0,
  payment_method TEXT,
  payment_type TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB
);

-- Printavo sync log
CREATE TABLE IF NOT EXISTS printavo_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT
);

-- =============================================================================
-- SECTION 4: Unified Payments Table
-- =============================================================================

-- Unified payments table (combines Printavo, Stripe, manual payments)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,

  -- Links
  invoice_id TEXT, -- nullable to support standalone payments
  customer_id uuid REFERENCES customers(id),

  -- Payment details
  amount NUMERIC NOT NULL CHECK (amount <> 0), -- can be negative for reversals
  payment_type TEXT CHECK (payment_type IS NULL OR payment_type IN ('cash', 'debit_credit', 'check_ach', 'stripe', 'other')),
  payment_method TEXT NOT NULL,
  check_number TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ NOT NULL,

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('manual', 'stripe', 'square', 'printavo', 'other')),
  source_payment_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reversed')),

  -- Audit
  created_by uuid REFERENCES auth.users(id),
  recorded_by uuid REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SECTION 5: Stripe Integration Tables
-- =============================================================================

-- Stripe customers
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stripe payment intents
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stripe invoices (for payment links and hosted invoices)
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
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

-- Stripe payment links
CREATE TABLE IF NOT EXISTS stripe_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT NOT NULL,
  printavo_visual_id TEXT,
  stripe_payment_link_id TEXT,
  stripe_payment_link_url TEXT,
  stripe_invoice_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'active',
  customer_email TEXT,
  customer_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Stripe payments tracking
CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'processing',
  customer_email TEXT,
  customer_name TEXT,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stripe webhook events log
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SECTION 6: Billing Queue & Communication
-- =============================================================================

-- Billing queue (invoices ready to be sent)
CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  printavo_invoice_id TEXT NOT NULL,
  printavo_visual_id TEXT,
  printavo_status TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_company TEXT,
  invoice_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  invoice_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  stripe_payment_link_id TEXT,
  stripe_invoice_id TEXT,
  sent_at TIMESTAMPTZ,
  sent_method TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Billing attempts log
CREATE TABLE IF NOT EXISTS billing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  queue_item_id uuid REFERENCES billing_queue(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Communication logs (emails, SMS, etc.)
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  printavo_invoice_id TEXT,
  communication_type TEXT NOT NULL,
  method TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_by uuid REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Paid invoices archive
CREATE TABLE IF NOT EXISTS paid_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT NOT NULL,
  printavo_visual_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  invoice_total NUMERIC(10, 2) NOT NULL,
  amount_paid NUMERIC(10, 2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SECTION 7: Automation & Reporting
-- =============================================================================

-- Automated reports configuration
CREATE TABLE IF NOT EXISTS automated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL,
  report_name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_time TIME NOT NULL DEFAULT '08:00:00',
  schedule_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  schedule_day_of_week INTEGER CHECK (schedule_day_of_week >= 0 AND schedule_day_of_week <= 6),
  schedule_day_of_month INTEGER CHECK (schedule_day_of_month >= 1 AND schedule_day_of_month <= 31),
  email_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_formats JSONB NOT NULL DEFAULT '["pdf"]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation rules
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  conditions JSONB DEFAULT '[]'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  scheduling JSONB DEFAULT '{"type": "immediate"}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Automation execution logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event JSONB DEFAULT '{}'::jsonb,
  executed_actions JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  execution_time_ms INTEGER DEFAULT 0
);

-- =============================================================================
-- SECTION 8: Storage Buckets
-- =============================================================================

-- Company logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 9: Indexes for Performance
-- =============================================================================

-- Company settings indexes
CREATE INDEX IF NOT EXISTS idx_company_settings_owner_id ON company_settings(owner_id);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Customer contacts indexes
CREATE INDEX IF NOT EXISTS idx_customer_contacts_company_id ON customer_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);

-- Printavo invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON printavo_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON printavo_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON printavo_invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON printavo_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status_stage ON printavo_invoices(status_stage);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON printavo_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON printavo_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_outstanding ON printavo_invoices(amount_outstanding);

-- Printavo line items indexes
CREATE INDEX IF NOT EXISTS idx_line_items_company_id ON printavo_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON printavo_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_extracted_style ON printavo_line_items(extracted_style) WHERE extracted_style IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_line_items_extracted_color ON printavo_line_items(extracted_color) WHERE extracted_color IS NOT NULL;

-- Printavo payments indexes
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_invoice_id ON printavo_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_payment_date ON printavo_payments(payment_date);

-- Sync log indexes
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON printavo_sync_log(started_at DESC);

-- Unified payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source);

-- Stripe indexes
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id ON stripe_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_printavo_invoice_id ON stripe_payment_links(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_status ON stripe_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id ON stripe_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_printavo_invoice_id ON stripe_payments(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_company_id ON stripe_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer_id ON stripe_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON stripe_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_printavo_invoice_id ON stripe_invoices(printavo_invoice_id);

-- Billing queue indexes
CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_printavo_invoice_id ON billing_queue(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_payment_status ON billing_queue(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_sent_at ON billing_queue(sent_at);

-- Communication logs indexes
CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_printavo_invoice_id ON communication_logs(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at);

-- Paid invoices indexes
CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_printavo_invoice_id ON paid_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_payment_date ON paid_invoices(payment_date);

-- Automated reports indexes
CREATE INDEX IF NOT EXISTS idx_automated_reports_user_id ON automated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_automated_reports_is_enabled ON automated_reports(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automated_reports_schedule_type ON automated_reports(schedule_type);

-- Automations indexes
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- =============================================================================
-- SECTION 10: Helper Functions
-- =============================================================================

-- Function to get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'super_admin'
  );
END;
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;

  RETURN user_role;
END;
$$;

-- Function to handle new user signup (creates company and profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- Create a new company for this user
  INSERT INTO public.company_settings (owner_id, company_name)
  VALUES (
    NEW.id,
    COALESCE(
      split_part(NEW.email, '@', 1) || '''s Company',
      'My Company'
    )
  )
  RETURNING id INTO new_company_id;

  -- Create user profile linked to the new company
  INSERT INTO public.user_profiles (id, email, role, company_id)
  VALUES (NEW.id, NEW.email, 'super_admin', new_company_id)
  ON CONFLICT (id) DO UPDATE
  SET
    role = 'super_admin',
    company_id = new_company_id,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 11: Triggers
-- =============================================================================

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Triggers for updated_at timestamps
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_contacts_updated_at ON customer_contacts;
CREATE TRIGGER update_customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_printavo_invoices_updated_at ON printavo_invoices;
CREATE TRIGGER update_printavo_invoices_updated_at
  BEFORE UPDATE ON printavo_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_printavo_payments_updated_at ON printavo_payments;
CREATE TRIGGER update_printavo_payments_updated_at
  BEFORE UPDATE ON printavo_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS stripe_payment_links_updated_at ON stripe_payment_links;
CREATE TRIGGER stripe_payment_links_updated_at
  BEFORE UPDATE ON stripe_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS stripe_payments_updated_at ON stripe_payments;
CREATE TRIGGER stripe_payments_updated_at
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS billing_queue_updated_at ON billing_queue;
CREATE TRIGGER billing_queue_updated_at
  BEFORE UPDATE ON billing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_automations_updated_at ON automations;
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 12: Enable Row Level Security
-- =============================================================================

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 13: RLS Policies (Company Isolation)
-- =============================================================================

-- Company Settings Policies
DROP POLICY IF EXISTS "Authenticated users can read company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;

CREATE POLICY "Users can read their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

CREATE POLICY "Users can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (id = get_user_company_id())
  WITH CHECK (id = get_user_company_id());

CREATE POLICY "New users can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- User Profiles Policies
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON user_profiles;

CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "New users can insert their profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Customers Policies
DROP POLICY IF EXISTS "Users can view all customers" ON customers;
DROP POLICY IF EXISTS "Users can insert customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers" ON customers;
DROP POLICY IF EXISTS "Users can view customers in their company" ON customers;
DROP POLICY IF EXISTS "Users can create customers for their company" ON customers;
DROP POLICY IF EXISTS "Users can update customers in their company" ON customers;
DROP POLICY IF EXISTS "Users can delete customers in their company" ON customers;

CREATE POLICY "Users can view customers in their company"
  ON customers FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create customers for their company"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update customers in their company"
  ON customers FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete customers in their company"
  ON customers FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Customer Contacts Policies
CREATE POLICY "Users can view customer contacts in their company"
  ON customer_contacts FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create customer contacts for their company"
  ON customer_contacts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update customer contacts in their company"
  ON customer_contacts FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete customer contacts in their company"
  ON customer_contacts FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Printavo Invoices Policies
DROP POLICY IF EXISTS "Allow public read access to invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can insert invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can update invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can delete invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Users can view invoices in their company" ON printavo_invoices;
DROP POLICY IF EXISTS "Users can update invoices in their company" ON printavo_invoices;
DROP POLICY IF EXISTS "Users can insert invoices for their company" ON printavo_invoices;

CREATE POLICY "Users can view invoices in their company"
  ON printavo_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update invoices in their company"
  ON printavo_invoices FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all invoices"
  ON printavo_invoices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Printavo Line Items Policies
CREATE POLICY "Users can view line items in their company"
  ON printavo_line_items FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all line items"
  ON printavo_line_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Printavo Payments Policies
DROP POLICY IF EXISTS "Allow public read access to payments" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can insert payments" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can update payments" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can delete payments" ON printavo_payments;

CREATE POLICY "Users can view payments in their company"
  ON printavo_payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all payments"
  ON printavo_payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Sync Log Policies
DROP POLICY IF EXISTS "Allow public read access to sync log" ON printavo_sync_log;
DROP POLICY IF EXISTS "Service role can insert sync log" ON printavo_sync_log;
DROP POLICY IF EXISTS "Service role can update sync log" ON printavo_sync_log;

CREATE POLICY "Authenticated users can read sync log"
  ON printavo_sync_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage sync log"
  ON printavo_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Unified Payments Policies
CREATE POLICY "Users can view payments in their company"
  ON payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create payments for their company"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update payments in their company"
  ON payments FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all payments"
  ON payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Stripe Policies (simplified for all Stripe tables)
DROP POLICY IF EXISTS "Users can view payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can create payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can update payment links" ON stripe_payment_links;

CREATE POLICY "Users can manage payment links in their company"
  ON stripe_payment_links FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can create payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can update payments" ON stripe_payments;

CREATE POLICY "Users can manage stripe payments in their company"
  ON stripe_payments FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can insert webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can update webhook events" ON stripe_webhook_events;

CREATE POLICY "Users can view webhook events"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage stripe customers in their company"
  ON stripe_customers FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can manage stripe invoices in their company"
  ON stripe_invoices FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Billing Queue Policies
DROP POLICY IF EXISTS "Users can view billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can insert to billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can update billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can delete from billing queue" ON billing_queue;

CREATE POLICY "Users can manage billing queue in their company"
  ON billing_queue FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can manage billing attempts in their company"
  ON billing_attempts FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Communication Logs Policies
DROP POLICY IF EXISTS "Users can view communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs" ON communication_logs;

CREATE POLICY "Users can manage communication logs in their company"
  ON communication_logs FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Paid Invoices Policies
DROP POLICY IF EXISTS "Users can view paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can insert paid invoices" ON paid_invoices;

CREATE POLICY "Users can manage paid invoices in their company"
  ON paid_invoices FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Automated Reports Policies
DROP POLICY IF EXISTS "Users can view own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can create own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can update own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON automated_reports;

CREATE POLICY "Users can view own automation rules"
  ON automated_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules"
  ON automated_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON automated_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON automated_reports
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Automations Policies
DROP POLICY IF EXISTS "Users can view all automations" ON automations;
DROP POLICY IF EXISTS "Users can insert automations" ON automations;
DROP POLICY IF EXISTS "Users can update automations" ON automations;
DROP POLICY IF EXISTS "Users can delete automations" ON automations;
DROP POLICY IF EXISTS "Users can view automations in their company" ON automations;
DROP POLICY IF EXISTS "Users can create automations for their company" ON automations;
DROP POLICY IF EXISTS "Users can update automations in their company" ON automations;
DROP POLICY IF EXISTS "Users can delete automations in their company" ON automations;

CREATE POLICY "Users can view automations in their company"
  ON automations FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create automations for their company"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update automations in their company"
  ON automations FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete automations in their company"
  ON automations FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Automation Logs Policies
DROP POLICY IF EXISTS "Users can view all automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Users can insert automation logs" ON automation_logs;

CREATE POLICY "Users can view automation logs"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage automation logs"
  ON automation_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- SECTION 14: Storage Policies
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Anyone can view logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can update logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
