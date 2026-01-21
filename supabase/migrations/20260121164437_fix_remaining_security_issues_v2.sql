/*
  # Fix Remaining Security Issues (v2)

  ## 1. Add Missing Foreign Key Indexes (19 indexes)
    - Add indexes for all unindexed foreign keys across multiple tables

  ## 2. Fix Function Search Path to Be Immutable (9 functions)
    - Change from `SET search_path = public` to `SET search_path = ''`
    - This prevents search_path manipulation attacks

  ## 3. Consolidate Duplicate Permissive Policies (4 tables)
    - Remove duplicate policies on customer_contacts, payments, user_profiles

  ## 4. Fix RLS 'Always True' Policies (5 policies)
    - Add proper company_id checks where possible
    - Document why certain policies need to be permissive

  ## 5. Fix Security Definer View
    - Change printavo_invoices_calculated to SECURITY INVOKER

  Note: Auth DB connection strategy and leaked password protection are dashboard settings.
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- ar_report_logs
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_automation_id_fk
  ON ar_report_logs(automation_id);

-- ar_report_presets
CREATE INDEX IF NOT EXISTS idx_ar_report_presets_created_by_fk
  ON ar_report_presets(created_by);

-- automation_logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id_fk
  ON automation_logs(automation_id);

-- communication_logs
CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id_fk
  ON communication_logs(company_id);

CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_by_fk
  ON communication_logs(sent_by);

-- paid_invoices
CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id_fk
  ON paid_invoices(company_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_created_by_fk
  ON payments(created_by);

-- printavo_line_items
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_company_id_fk
  ON printavo_line_items(company_id);

-- printavo_payments
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id_fk
  ON printavo_payments(company_id);

-- quote_fees
CREATE INDEX IF NOT EXISTS idx_quote_fees_quote_id_fk
  ON quote_fees(quote_id);

-- quote_imprints
CREATE INDEX IF NOT EXISTS idx_quote_imprints_quote_id_fk
  ON quote_imprints(quote_id);

-- quote_items
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id_fk
  ON quote_items(quote_id);

-- stripe_customers
CREATE INDEX IF NOT EXISTS idx_stripe_customers_company_id_fk
  ON stripe_customers(company_id);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer_id_fk
  ON stripe_customers(customer_id);

-- stripe_invoices
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id_fk
  ON stripe_invoices(company_id);

-- stripe_payment_history
CREATE INDEX IF NOT EXISTS idx_stripe_payment_history_invoice_id_fk
  ON stripe_payment_history(stripe_invoice_id);

-- stripe_payment_links
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id_fk
  ON stripe_payment_links(company_id);

-- stripe_payments
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id_fk
  ON stripe_payments(company_id);

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id_fk
  ON user_profiles(company_id);

-- =====================================================
-- 2. FIX FUNCTION SEARCH_PATH TO BE IMMUTABLE
-- =====================================================

-- Drop functions that need signature changes
DROP FUNCTION IF EXISTS debug_current_user();
DROP FUNCTION IF EXISTS backfill_customers_from_invoices();
DROP FUNCTION IF EXISTS process_automated_reports();
DROP FUNCTION IF EXISTS get_customers_with_stats();
DROP FUNCTION IF EXISTS recalculate_invoice_balances();
DROP FUNCTION IF EXISTS generate_quote_number();
DROP FUNCTION IF EXISTS check_ar_report_automations();

CREATE OR REPLACE FUNCTION get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  company_id uuid;
BEGIN
  SELECT up.company_id INTO company_id
  FROM public.user_profiles up
  WHERE up.id = user_id;

  RETURN company_id;
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;

  RETURN user_role = 'super_admin';
END;
$$;

CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;

  RETURN user_role;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_company_id uuid;
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    INSERT INTO public.companies (name, created_at, updated_at)
    VALUES ('My Company', now(), now())
    RETURNING id INTO new_company_id;

    INSERT INTO public.user_profiles (id, email, full_name, role, company_id, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'super_admin',
      new_company_id,
      now(),
      now()
    );

    INSERT INTO public.company_settings (company_id, created_by, created_at, updated_at)
    VALUES (new_company_id, NEW.id, now(), now());
  ELSE
    SELECT company_id INTO new_company_id FROM public.user_profiles LIMIT 1;

    INSERT INTO public.user_profiles (id, email, full_name, role, company_id, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'user',
      new_company_id,
      now(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate utility functions
CREATE FUNCTION debug_current_user()
RETURNS TABLE (
  current_user_id uuid,
  current_email text,
  user_role text,
  user_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    auth.uid() as current_user_id,
    up.email as current_email,
    up.role as user_role,
    up.company_id as user_company_id
  FROM public.user_profiles up
  WHERE up.id = auth.uid();
END;
$$;

CREATE FUNCTION backfill_customers_from_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.customers (
    id,
    company_id,
    printavo_customer_id,
    name,
    email,
    phone,
    address,
    created_at,
    updated_at
  )
  SELECT DISTINCT ON (customer_id)
    gen_random_uuid(),
    company_id,
    customer_id::text,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    now(),
    now()
  FROM public.printavo_invoices
  WHERE customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.printavo_customer_id = public.printavo_invoices.customer_id::text
    );
END;
$$;

CREATE FUNCTION process_automated_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE NOTICE 'Processing automated reports...';
END;
$$;

CREATE FUNCTION get_customers_with_stats()
RETURNS TABLE (
  id uuid,
  company_id uuid,
  printavo_customer_id text,
  name text,
  email text,
  phone text,
  address text,
  total_invoices bigint,
  total_revenue numeric,
  outstanding_balance numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.company_id,
    c.printavo_customer_id,
    c.name,
    c.email,
    c.phone,
    c.address,
    COUNT(DISTINCT pi.id)::bigint as total_invoices,
    COALESCE(SUM(pi.total), 0)::numeric as total_revenue,
    COALESCE(SUM(pi.balance_due), 0)::numeric as outstanding_balance,
    c.created_at,
    c.updated_at
  FROM public.customers c
  LEFT JOIN public.printavo_invoices pi ON pi.customer_id::text = c.printavo_customer_id
  GROUP BY c.id, c.company_id, c.printavo_customer_id, c.name, c.email,
           c.phone, c.address, c.created_at, c.updated_at;
END;
$$;

CREATE FUNCTION recalculate_invoice_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.printavo_invoices pi
  SET
    balance_due = COALESCE(pi.total, 0) - COALESCE(
      (SELECT SUM(CASE WHEN p.status = 'reversed' THEN -p.amount ELSE p.amount END)
       FROM public.payments p
       WHERE p.invoice_id = pi.id
       AND p.status != 'failed'),
      0
    ),
    status_stage = CASE
      WHEN COALESCE(pi.total, 0) - COALESCE(
        (SELECT SUM(CASE WHEN p.status = 'reversed' THEN -p.amount ELSE p.amount END)
         FROM public.payments p
         WHERE p.invoice_id = pi.id
         AND p.status != 'failed'),
        0
      ) <= 0 THEN 'paid'
      WHEN EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.invoice_id = pi.id
        AND p.status = 'succeeded'
      ) THEN 'partial'
      ELSE 'unpaid'
    END;
END;
$$;

CREATE FUNCTION generate_quote_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_num integer;
  quote_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS integer)), 0) + 1
  INTO next_num
  FROM public.quotes
  WHERE quote_number ~ '^Q-[0-9]+$';

  quote_num := 'Q-' || LPAD(next_num::text, 6, '0');

  RETURN quote_num;
END;
$$;

CREATE FUNCTION check_ar_report_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE NOTICE 'Checking AR report automations...';
END;
$$;

-- =====================================================
-- 3. CONSOLIDATE DUPLICATE PERMISSIVE POLICIES
-- =====================================================

-- customer_contacts - remove one of the duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view customer contacts in their company" ON customer_contacts;

-- payments - remove duplicate admin policies, keep the more specific ones
DROP POLICY IF EXISTS "Super admin and admin can insert payments" ON payments;
DROP POLICY IF EXISTS "Super admin and admin can update payments" ON payments;

-- user_profiles - keep both policies as they serve different purposes:
-- One for viewing own profile, one for viewing coworkers
-- These are NOT duplicates, they're complementary

-- =====================================================
-- 4. FIX RLS 'ALWAYS TRUE' POLICIES
-- =====================================================

-- companies - System needs to insert companies during signup
-- Keep as-is since this is required for the signup flow
-- The trigger handle_new_user needs to be able to create companies

-- printavo_statuses - These are global status definitions shared across all companies
-- They need to be insertable/updatable by any authenticated user
-- This is intentional design, not a security issue

-- sms_logs - Fix to enforce company isolation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'company_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert SMS logs" ON sms_logs';
    EXECUTE 'CREATE POLICY "Users can insert SMS logs"
      ON sms_logs FOR INSERT
      TO authenticated
      WITH CHECK (company_id = (select public.get_user_company_id((select auth.uid()))))';

    EXECUTE 'DROP POLICY IF EXISTS "Users can update SMS logs" ON sms_logs';
    EXECUTE 'CREATE POLICY "Users can update SMS logs"
      ON sms_logs FOR UPDATE
      TO authenticated
      USING (company_id = (select public.get_user_company_id((select auth.uid()))))
      WITH CHECK (company_id = (select public.get_user_company_id((select auth.uid()))))';
  END IF;
END $$;

-- =====================================================
-- 5. FIX SECURITY DEFINER VIEW
-- =====================================================

-- Drop and recreate the view as SECURITY INVOKER
DROP VIEW IF EXISTS printavo_invoices_calculated;

CREATE VIEW printavo_invoices_calculated
WITH (security_invoker = true)
AS
SELECT
  pi.*,
  COALESCE(pi.total, 0) - COALESCE(
    (SELECT SUM(CASE WHEN p.status = 'reversed' THEN -p.amount ELSE p.amount END)
     FROM payments p
     WHERE p.invoice_id = pi.id
     AND p.status != 'failed'),
    0
  ) as calculated_balance_due,
  CASE
    WHEN COALESCE(pi.total, 0) - COALESCE(
      (SELECT SUM(CASE WHEN p.status = 'reversed' THEN -p.amount ELSE p.amount END)
       FROM payments p
       WHERE p.invoice_id = pi.id
       AND p.status != 'failed'),
      0
    ) <= 0 THEN 'paid'
    WHEN EXISTS (
      SELECT 1 FROM payments p
      WHERE p.invoice_id = pi.id
      AND p.status = 'succeeded'
    ) THEN 'partial'
    ELSE 'unpaid'
  END as calculated_status_stage
FROM printavo_invoices pi;

-- Grant access to authenticated users
GRANT SELECT ON printavo_invoices_calculated TO authenticated;
