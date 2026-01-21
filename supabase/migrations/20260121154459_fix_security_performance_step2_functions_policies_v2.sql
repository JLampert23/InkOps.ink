/*
  # Fix Security and Performance Issues - Step 2: Functions and Policies (v2)

  ## 1. Fix Function Search Path Issues
    - Set explicit search_path for all SECURITY DEFINER functions

  ## 2. Fix Auth RLS Initialization Performance
    - Fix user_profiles policies to use (select auth.uid())
    - Fix automated_reports policies to use (select auth.uid()) with correct column name
    - Fix customer_contacts policy to use (select auth.uid())

  ## 3. Consolidate Multiple Permissive Policies
    - Remove duplicate policies that provide the same access

  ## 4. Fix RLS Policy 'Always True' Vulnerabilities
    - Replace true conditions with proper company_id checks

  ## 5. Enable RLS on Companies Table
    - Enable RLS and add appropriate policies
*/

-- =====================================================
-- FIX FUNCTION SEARCH_PATH ISSUES
-- =====================================================

-- Recreate core helper functions with SET search_path
CREATE OR REPLACE FUNCTION get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_id uuid;
BEGIN
  SELECT up.company_id INTO company_id
  FROM user_profiles up
  WHERE up.id = user_id;

  RETURN company_id;
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;

  RETURN user_role = 'super_admin';
END;
$$;

CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    INSERT INTO companies (name, created_at, updated_at)
    VALUES ('My Company', now(), now())
    RETURNING id INTO new_company_id;

    INSERT INTO user_profiles (id, email, full_name, role, company_id, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'super_admin',
      new_company_id,
      now(),
      now()
    );

    INSERT INTO company_settings (company_id, created_by, created_at, updated_at)
    VALUES (new_company_id, NEW.id, now(), now());
  ELSE
    SELECT company_id INTO new_company_id FROM user_profiles LIMIT 1;

    INSERT INTO user_profiles (id, email, full_name, role, company_id, created_at, updated_at)
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
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- FIX AUTH RLS INITIALIZATION (performance)
-- =====================================================

-- user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (company_id = (select get_user_company_id((select auth.uid()))));

-- automated_reports policies (using user_id, not created_by)
DROP POLICY IF EXISTS "Users can view own automation rules" ON automated_reports;
CREATE POLICY "Users can view own automation rules"
  ON automated_reports FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own automation rules" ON automated_reports;
CREATE POLICY "Users can create own automation rules"
  ON automated_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own automation rules" ON automated_reports;
CREATE POLICY "Users can update own automation rules"
  ON automated_reports FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own automation rules" ON automated_reports;
CREATE POLICY "Users can delete own automation rules"
  ON automated_reports FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- customer_contacts policy
DROP POLICY IF EXISTS "Users can view customer contacts from their company" ON customer_contacts;
CREATE POLICY "Users can view customer contacts from their company"
  ON customer_contacts FOR SELECT
  TO authenticated
  USING (company_id = (select get_user_company_id((select auth.uid()))));

-- =====================================================
-- CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- automated_reports - remove admin duplicate policies
DROP POLICY IF EXISTS "Users and admins can view automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users and admins can create automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users and admins can update automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users and admins can delete automation rules" ON automated_reports;

-- automations - remove duplicate insert policy
DROP POLICY IF EXISTS "Users can insert automations for their company" ON automations;

-- billing_queue - remove duplicate policies (keep company-scoped ones)
DROP POLICY IF EXISTS "Users can manage billing queue in their company" ON billing_queue;

-- communication_logs - remove duplicate policies
DROP POLICY IF EXISTS "Users can manage communication logs in their company" ON communication_logs;

-- customer_contacts - remove old policies, keep company-scoped ones
DROP POLICY IF EXISTS "Users can view all customer contacts" ON customer_contacts;
DROP POLICY IF EXISTS "Users can insert customer contacts" ON customer_contacts;
DROP POLICY IF EXISTS "Users can update customer contacts" ON customer_contacts;
DROP POLICY IF EXISTS "Users can delete customer contacts" ON customer_contacts;

-- paid_invoices - remove duplicate policy
DROP POLICY IF EXISTS "Users can manage paid invoices in their company" ON paid_invoices;

-- payments - consolidate admin policies
DROP POLICY IF EXISTS "Admins can update payments in their company" ON payments;
DROP POLICY IF EXISTS "Admins can delete payments in their company" ON payments;
DROP POLICY IF EXISTS "Users can insert payments for their company" ON payments;

-- quotes - remove duplicate insert policy
DROP POLICY IF EXISTS "Users can insert quotes" ON quotes;

-- stripe_invoices - remove duplicate policies
DROP POLICY IF EXISTS "Users can manage stripe invoices in their company" ON stripe_invoices;

-- stripe_payment_links - remove duplicate policies
DROP POLICY IF EXISTS "Users can manage payment links in their company" ON stripe_payment_links;

-- stripe_payments - remove duplicate policies
DROP POLICY IF EXISTS "Users can manage stripe payments in their company" ON stripe_payments;

-- stripe_webhook_events - remove duplicate policy
DROP POLICY IF EXISTS "Users can view webhook events" ON stripe_webhook_events;

-- =====================================================
-- FIX RLS POLICY 'ALWAYS TRUE' VULNERABILITIES
-- =====================================================

-- customer_contacts - enforce company isolation
DROP POLICY IF EXISTS "Users can delete customer contacts in their company" ON customer_contacts;
CREATE POLICY "Users can delete customer contacts in their company"
  ON customer_contacts FOR DELETE
  TO authenticated
  USING (company_id = (select get_user_company_id((select auth.uid()))));

DROP POLICY IF EXISTS "Users can create customer contacts for their company" ON customer_contacts;
CREATE POLICY "Users can create customer contacts for their company"
  ON customer_contacts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (select get_user_company_id((select auth.uid()))));

DROP POLICY IF EXISTS "Users can update customer contacts in their company" ON customer_contacts;
CREATE POLICY "Users can update customer contacts in their company"
  ON customer_contacts FOR UPDATE
  TO authenticated
  USING (company_id = (select get_user_company_id((select auth.uid()))))
  WITH CHECK (company_id = (select get_user_company_id((select auth.uid()))));

-- printavo_statuses - these are global statuses shared across the system
DROP POLICY IF EXISTS "Authenticated users can insert statuses" ON printavo_statuses;
CREATE POLICY "Authenticated users can insert statuses"
  ON printavo_statuses FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update billing eligibility" ON printavo_statuses;
CREATE POLICY "Authenticated users can update billing eligibility"
  ON printavo_statuses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- quote_fees - enforce company isolation via quote relationship
DROP POLICY IF EXISTS "Users can insert quote fees" ON quote_fees;
CREATE POLICY "Users can insert quote fees"
  ON quote_fees FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_fees.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

DROP POLICY IF EXISTS "Users can update quote fees" ON quote_fees;
CREATE POLICY "Users can update quote fees"
  ON quote_fees FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_fees.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_fees.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

DROP POLICY IF EXISTS "Users can delete quote fees" ON quote_fees;
CREATE POLICY "Users can delete quote fees"
  ON quote_fees FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_fees.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

-- quote_imprints - enforce company isolation via quote relationship
DROP POLICY IF EXISTS "Users can insert quote imprints" ON quote_imprints;
CREATE POLICY "Users can insert quote imprints"
  ON quote_imprints FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_imprints.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

DROP POLICY IF EXISTS "Users can update quote imprints" ON quote_imprints;
CREATE POLICY "Users can update quote imprints"
  ON quote_imprints FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_imprints.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_imprints.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

DROP POLICY IF EXISTS "Users can delete quote imprints" ON quote_imprints;
CREATE POLICY "Users can delete quote imprints"
  ON quote_imprints FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_imprints.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

-- quote_items - enforce company isolation via quote relationship
DROP POLICY IF EXISTS "Users can insert quote items" ON quote_items;
CREATE POLICY "Users can insert quote items"
  ON quote_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_items.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

DROP POLICY IF EXISTS "Users can update quote items" ON quote_items;
CREATE POLICY "Users can update quote items"
  ON quote_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_items.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_items.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

DROP POLICY IF EXISTS "Users can delete quote items" ON quote_items;
CREATE POLICY "Users can delete quote items"
  ON quote_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_items.quote_id
    AND quotes.company_id = (select get_user_company_id((select auth.uid())))
  ));

-- quotes - enforce company isolation
DROP POLICY IF EXISTS "Users can create quotes for their company" ON quotes;
CREATE POLICY "Users can create quotes for their company"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (select get_user_company_id((select auth.uid()))));

-- sms_logs - enforce company isolation
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
      WITH CHECK (company_id = (select get_user_company_id((select auth.uid()))))';

    EXECUTE 'DROP POLICY IF EXISTS "Users can update SMS logs" ON sms_logs';
    EXECUTE 'CREATE POLICY "Users can update SMS logs"
      ON sms_logs FOR UPDATE
      TO authenticated
      USING (company_id = (select get_user_company_id((select auth.uid()))))
      WITH CHECK (company_id = (select get_user_company_id((select auth.uid()))))';
  END IF;
END $$;

-- stripe_payment_history - enforce company isolation via invoice relationship
DROP POLICY IF EXISTS "Authenticated users can create payment history" ON stripe_payment_history;
CREATE POLICY "Authenticated users can create payment history"
  ON stripe_payment_history FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM stripe_invoices
    WHERE stripe_invoices.id = stripe_payment_history.stripe_invoice_id
    AND stripe_invoices.company_id = (select get_user_company_id((select auth.uid())))
  ));

-- =====================================================
-- ENABLE RLS ON COMPANIES TABLE
-- =====================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company" ON companies;
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (id = (select get_user_company_id((select auth.uid()))));

DROP POLICY IF EXISTS "Super admins can update their company" ON companies;
CREATE POLICY "Super admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id = (select get_user_company_id((select auth.uid())))
    AND (select is_super_admin((select auth.uid())))
  )
  WITH CHECK (
    id = (select get_user_company_id((select auth.uid())))
    AND (select is_super_admin((select auth.uid())))
  );

DROP POLICY IF EXISTS "System can insert companies" ON companies;
CREATE POLICY "System can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);
