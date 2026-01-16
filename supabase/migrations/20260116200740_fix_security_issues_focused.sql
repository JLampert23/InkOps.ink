/*
  # Fix Security and Performance Issues (Focused)

  This migration addresses security and performance issues that can be fixed without schema changes:

  ## 1. Add Missing Indexes on Foreign Keys
  Improves query performance for foreign key relationships

  ## 2. Fix Auth RLS Performance
  Wraps auth.uid() calls with SELECT to prevent re-evaluation per row

  ## 3. Fix Function Search Paths
  Sets search_path to be immutable for security

  ## Note on RLS Policies with USING (true)
  Some tables lack company_id columns and currently use USING (true) policies.
  These are documented as known issues but require schema changes to fix properly.
  Tables affected: automations, customers, quotes, and their related tables.
*/

-- =====================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ar_report_automations_created_by 
  ON ar_report_automations(created_by);

CREATE INDEX IF NOT EXISTS idx_ar_report_presets_created_by 
  ON ar_report_presets(created_by);

CREATE INDEX IF NOT EXISTS idx_automations_created_by 
  ON automations(created_by);

CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_by 
  ON communication_logs(sent_by);

CREATE INDEX IF NOT EXISTS idx_customers_created_by 
  ON customers(created_by);

CREATE INDEX IF NOT EXISTS idx_payments_created_by 
  ON payments(created_by);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
  ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_quotes_created_by 
  ON quotes(created_by);

-- =====================================================
-- 2. FIX AUTH RLS PERFORMANCE ISSUES
-- Wrap auth.uid() with (select auth.uid()) to prevent re-evaluation
-- =====================================================

-- automated_reports policies
DROP POLICY IF EXISTS "Users and admins can view automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users and admins can create automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users and admins can update automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users and admins can delete automation rules" ON automated_reports;

CREATE POLICY "Users and admins can view automation rules"
  ON automated_reports FOR SELECT
  TO authenticated
  USING (
    ((select auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    ))
  );

CREATE POLICY "Users and admins can create automation rules"
  ON automated_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    ((select auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    ))
  );

CREATE POLICY "Users and admins can update automation rules"
  ON automated_reports FOR UPDATE
  TO authenticated
  USING (
    ((select auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    ))
  )
  WITH CHECK (
    ((select auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    ))
  );

CREATE POLICY "Users and admins can delete automation rules"
  ON automated_reports FOR DELETE
  TO authenticated
  USING (
    ((select auth.uid()) = user_id) OR 
    (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    ))
  );

-- user_profiles policies
DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;

CREATE POLICY "Users can update own profile, admins can update any"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid())
      AND up.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    (select auth.uid()) = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid())
      AND up.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete user profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (select auth.uid())
      AND up.role IN ('super_admin', 'admin')
    )
  );

-- ar_report_presets policies
DROP POLICY IF EXISTS "Users can view their company's AR report presets" ON ar_report_presets;
DROP POLICY IF EXISTS "Users can create AR report presets for their company" ON ar_report_presets;
DROP POLICY IF EXISTS "Users can update their company's AR report presets" ON ar_report_presets;
DROP POLICY IF EXISTS "Users can delete their company's AR report presets" ON ar_report_presets;

CREATE POLICY "Users can view their company's AR report presets"
  ON ar_report_presets FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create AR report presets for their company"
  ON ar_report_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update their company's AR report presets"
  ON ar_report_presets FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete their company's AR report presets"
  ON ar_report_presets FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

-- ar_report_automations policies
DROP POLICY IF EXISTS "Users can view their company's AR report automations" ON ar_report_automations;
DROP POLICY IF EXISTS "Users can create AR report automations for their company" ON ar_report_automations;
DROP POLICY IF EXISTS "Users can update their company's AR report automations" ON ar_report_automations;
DROP POLICY IF EXISTS "Users can delete their company's AR report automations" ON ar_report_automations;

CREATE POLICY "Users can view their company's AR report automations"
  ON ar_report_automations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create AR report automations for their company"
  ON ar_report_automations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update their company's AR report automations"
  ON ar_report_automations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete their company's AR report automations"
  ON ar_report_automations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

-- ar_report_logs policies
DROP POLICY IF EXISTS "Users can view their company's AR report logs" ON ar_report_logs;

CREATE POLICY "Users can view their company's AR report logs"
  ON ar_report_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_settings.id FROM company_settings
      WHERE company_settings.owner_id = (select auth.uid())
    )
  );

-- payments policies
DROP POLICY IF EXISTS "Super admin and admin can insert payments" ON payments;
DROP POLICY IF EXISTS "Super admin and admin can update payments" ON payments;
DROP POLICY IF EXISTS "Super admin and admin can delete payments" ON payments;

CREATE POLICY "Super admin and admin can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admin and admin can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admin and admin can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- 3. FIX FUNCTION SEARCH PATHS
-- Set search_path to be immutable for all functions
-- =====================================================

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

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION update_stripe_payment_links_updated_at()
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

CREATE OR REPLACE FUNCTION update_stripe_payments_updated_at()
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

CREATE OR REPLACE FUNCTION update_billing_queue_updated_at()
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

CREATE OR REPLACE FUNCTION update_stripe_invoice_updated_at()
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

CREATE OR REPLACE FUNCTION update_payment_updated_at()
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

-- Helper function for getting user's company
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_settings.id 
  FROM company_settings 
  WHERE company_settings.owner_id = auth.uid()
  LIMIT 1;
$$;
