-- =============================================================================
-- FIX MISSING COLUMNS IN PRODUCTION DATABASE
-- =============================================================================
-- This script adds missing columns to existing tables
-- Safe to run multiple times - only adds columns if they don't exist
-- =============================================================================

-- Add company_id to printavo_invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_printavo_invoices_company_id ON printavo_invoices(company_id);
  END IF;
END $$;

-- Add customer_id to printavo_invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_id uuid REFERENCES customers(id);
    CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id ON printavo_invoices(customer_id);
  END IF;
END $$;

-- Add company_id to printavo_line_items if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_line_items' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE printavo_line_items ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_printavo_line_items_company_id ON printavo_line_items(company_id);
  END IF;
END $$;

-- Add company_id to printavo_payments if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_payments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE printavo_payments ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
  END IF;
END $$;

-- Add company_id to payments if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
  END IF;
END $$;

-- Add customer_id to payments if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN customer_id uuid REFERENCES customers(id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
  END IF;
END $$;

-- Add company_id to customers if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
  END IF;
END $$;

-- Add company_id to customer_contacts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_contacts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customer_contacts ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customer_contacts_company_id ON customer_contacts(company_id);
  END IF;
END $$;

-- Add company_id to billing_queue if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_queue' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE billing_queue ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
  END IF;
END $$;

-- Add company_id to billing_attempts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_attempts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE billing_attempts ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_billing_attempts_company_id ON billing_attempts(company_id);
  END IF;
END $$;

-- Add company_id to communication_logs if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE communication_logs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
  END IF;
END $$;

-- Add company_id to stripe_customers if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE stripe_customers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_stripe_customers_company_id ON stripe_customers(company_id);
  END IF;
END $$;

-- Add company_id to stripe_payment_intents if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_payment_intents' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE stripe_payment_intents ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_company_id ON stripe_payment_intents(company_id);
  END IF;
END $$;

-- Add company_id to stripe_invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_invoices' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE stripe_invoices ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON stripe_invoices(company_id);
  END IF;
END $$;

-- Add company_id to automated_reports if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automated_reports' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE automated_reports ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_automated_reports_company_id ON automated_reports(company_id);
  END IF;
END $$;

-- Add company_id to automation_rules if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_rules' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE automation_rules ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_automation_rules_company_id ON automation_rules(company_id);
  END IF;
END $$;

-- Add company_id to automation_logs if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE automation_logs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_automation_logs_company_id ON automation_logs(company_id);
  END IF;
END $$;

-- Add all other customer fields to printavo_invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_email') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_company') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_company TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_address') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_city') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_state') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_state TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'customer_zip') THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_zip TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'status_stage') THEN
    ALTER TABLE printavo_invoices ADD COLUMN status_stage TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'financially_locked') THEN
    ALTER TABLE printavo_invoices ADD COLUMN financially_locked BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'locked_at') THEN
    ALTER TABLE printavo_invoices ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'locked_by') THEN
    ALTER TABLE printavo_invoices ADD COLUMN locked_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add company info fields to printavo_invoices if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_name') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_logo_url') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_logo_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_logo_base64') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_logo_base64 TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_address') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_city') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_state') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_state TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_zip') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_zip TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_phone') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'company_email') THEN
    ALTER TABLE printavo_invoices ADD COLUMN company_email TEXT;
  END IF;
END $$;

-- Add garment metadata fields to printavo_line_items if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'style_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN style_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'style_number') THEN
    ALTER TABLE printavo_line_items ADD COLUMN style_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'color_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN color_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'size_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN size_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'product_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN product_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'category_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN category_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'task_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN task_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_line_items' AND column_name = 'decoration_name') THEN
    ALTER TABLE printavo_line_items ADD COLUMN decoration_name TEXT;
  END IF;
END $$;

-- Add status column to payments if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'status') THEN
    ALTER TABLE payments ADD COLUMN status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reversed'));
  END IF;
END $$;

-- Add unlock_pin_hash to user_profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'unlock_pin_hash') THEN
    ALTER TABLE user_profiles ADD COLUMN unlock_pin_hash TEXT;
  END IF;
END $$;

-- Add company logo fields to company_settings if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_logo_url') THEN
    ALTER TABLE company_settings ADD COLUMN company_logo_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_logo_base64') THEN
    ALTER TABLE company_settings ADD COLUMN company_logo_base64 TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_address') THEN
    ALTER TABLE company_settings ADD COLUMN company_address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_city') THEN
    ALTER TABLE company_settings ADD COLUMN company_city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_state') THEN
    ALTER TABLE company_settings ADD COLUMN company_state TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_zip') THEN
    ALTER TABLE company_settings ADD COLUMN company_zip TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_phone') THEN
    ALTER TABLE company_settings ADD COLUMN company_phone TEXT;
  END IF;
END $$;

-- =============================================================================
-- BACKFILL company_id for existing data (if user_profiles exists)
-- =============================================================================

-- Get the first company_id from user_profiles and use it to backfill
DO $$
DECLARE
  first_company_id uuid;
BEGIN
  -- Get the first company_id
  SELECT company_id INTO first_company_id
  FROM user_profiles
  LIMIT 1;

  -- Only proceed if we found a company_id
  IF first_company_id IS NOT NULL THEN
    -- Update all tables with NULL company_id
    UPDATE printavo_invoices SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE printavo_line_items SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE printavo_payments SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE customers SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE customer_contacts SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE payments SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE billing_queue SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE billing_attempts SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE communication_logs SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE stripe_customers SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE stripe_payment_intents SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE stripe_invoices SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE automated_reports SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE automation_rules SET company_id = first_company_id WHERE company_id IS NULL;
    UPDATE automation_logs SET company_id = first_company_id WHERE company_id IS NULL;
  END IF;
END $$;
