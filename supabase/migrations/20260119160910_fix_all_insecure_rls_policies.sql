/*
  # CRITICAL SECURITY FIX: Remove All Insecure RLS Policies
  
  ## Problem
  Multiple tables have policies with USING (true) that allow ANY authenticated user
  to see ALL data across ALL companies. This completely breaks company data isolation.
  
  Insecure policies found:
  - automations: "Users can view all automations"
  - company_settings: "Authenticated users can read company settings"  
  - customers: "Users can view all customers"
  - payments: "Authenticated users can view payments"
  - quotes: "Users can view all quotes"
  - user_profiles: "Users can read all profiles"
  
  ## Solution
  Drop all insecure policies and ensure only company-specific policies remain.
  
  ## Security Impact
  After this fix, users will ONLY see data belonging to their company.
*/

-- Drop all insecure policies that bypass company isolation

-- Automations
DROP POLICY IF EXISTS "Users can view all automations" ON automations;
DROP POLICY IF EXISTS "Users can update automations" ON automations;
DROP POLICY IF EXISTS "Users can delete automations" ON automations;

-- Company Settings
DROP POLICY IF EXISTS "Authenticated users can read company settings" ON company_settings;

-- Customers  
DROP POLICY IF EXISTS "Users can view all customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers" ON customers;

-- Payments
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;

-- Quotes
DROP POLICY IF EXISTS "Users can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete quotes" ON quotes;

-- User Profiles
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;

-- Create secure company-specific policies for company_settings
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

CREATE POLICY "Super admins can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (id = get_user_company_id() AND get_user_role() = 'super_admin')
  WITH CHECK (id = get_user_company_id());

-- Create secure company-specific policies for payments
CREATE POLICY "Users can view payments in their company"
  ON payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert payments for their company"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Admins can update payments in their company"
  ON payments FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id() AND get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Admins can delete payments in their company"
  ON payments FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id() AND get_user_role() IN ('super_admin', 'admin'));

-- Ensure company-specific policies exist for other tables
-- (These should already exist from the previous migration, but verify)

DO $$
BEGIN
  -- Automations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Users can view automations in their company') THEN
    CREATE POLICY "Users can view automations in their company"
      ON automations FOR SELECT
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Users can create automations for their company') THEN
    CREATE POLICY "Users can create automations for their company"
      ON automations FOR INSERT
      TO authenticated
      WITH CHECK (company_id = get_user_company_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Users can update automations in their company') THEN
    CREATE POLICY "Users can update automations in their company"
      ON automations FOR UPDATE
      TO authenticated
      USING (company_id = get_user_company_id())
      WITH CHECK (company_id = get_user_company_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automations' AND policyname = 'Users can delete automations in their company') THEN
    CREATE POLICY "Users can delete automations in their company"
      ON automations FOR DELETE
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;

  -- Customers (should already exist)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Users can view customers in their company') THEN
    CREATE POLICY "Users can view customers in their company"
      ON customers FOR SELECT
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;

  -- Quotes (should already exist)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'Users can view quotes in their company') THEN
    CREATE POLICY "Users can view quotes in their company"
      ON quotes FOR SELECT
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;

  -- User Profiles (should already exist)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view profiles in their company') THEN
    CREATE POLICY "Users can view profiles in their company"
      ON user_profiles FOR SELECT
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;
END $$;
