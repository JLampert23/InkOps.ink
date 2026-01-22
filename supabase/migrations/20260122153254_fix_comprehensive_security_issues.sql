/*
  # Fix Comprehensive Security Issues

  This migration addresses multiple security and performance issues identified:

  1. RLS Performance Issues
    - Fix customer_fundraising_credits policies to use (select auth.uid())
    - Prevents re-evaluation of auth.uid() for each row

  2. SMS Logs Security
    - Add missing company_id column to sms_logs table
    - Fix RLS policies to enforce company isolation

  3. Multiple Permissive Policies
    - Consolidate user_profiles SELECT policies

  4. Function Security
    - Fix search_path on functions to be immutable

  5. RLS "Always True" Policies
    - Fix sms_logs policies to enforce proper security

  6. Clean Up Unused Indexes
    - Drop indexes that are not being used to save space

  ## Changes
  - Update 4 policies on customer_fundraising_credits
  - Add company_id to sms_logs and update policies
  - Fix 3 functions with mutable search paths
  - Consolidate user_profiles policies
  - Drop unused indexes
*/

-- =====================================================
-- 1. FIX RLS PERFORMANCE ON FUNDRAISING CREDITS
-- =====================================================

-- Drop and recreate policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can view fundraising credits in their company" ON customer_fundraising_credits;
CREATE POLICY "Users can view fundraising credits in their company"
  ON customer_fundraising_credits FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert fundraising credits in their company" ON customer_fundraising_credits;
CREATE POLICY "Users can insert fundraising credits in their company"
  ON customer_fundraising_credits FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update fundraising credits in their company" ON customer_fundraising_credits;
CREATE POLICY "Users can update fundraising credits in their company"
  ON customer_fundraising_credits FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete fundraising credits in their company" ON customer_fundraising_credits;
CREATE POLICY "Users can delete fundraising credits in their company"
  ON customer_fundraising_credits FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- 2. FIX SMS LOGS - ADD COMPANY_ID AND UPDATE POLICIES
-- =====================================================

-- Add company_id column to sms_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE sms_logs ADD COLUMN company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE;
    
    -- Backfill company_id from customer relationship
    UPDATE sms_logs
    SET company_id = customers.company_id
    FROM customers
    WHERE sms_logs.customer_id = customers.id
    AND sms_logs.company_id IS NULL;
    
    -- Make company_id NOT NULL after backfill
    ALTER TABLE sms_logs ALTER COLUMN company_id SET NOT NULL;
    
    -- Add index for company_id
    CREATE INDEX IF NOT EXISTS idx_sms_logs_company_id ON sms_logs(company_id);
  END IF;
END $$;

-- Drop and recreate SMS logs policies with proper company isolation
DROP POLICY IF EXISTS "Users can read SMS logs" ON sms_logs;
CREATE POLICY "Users can read SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert SMS logs" ON sms_logs;
CREATE POLICY "Users can insert SMS logs"
  ON sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update SMS logs" ON sms_logs;
CREATE POLICY "Users can update SMS logs"
  ON sms_logs FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete SMS logs" ON sms_logs;
CREATE POLICY "Users can delete SMS logs"
  ON sms_logs FOR DELETE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
  ));

-- =====================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES ON USER_PROFILES
-- =====================================================

-- Drop the overlapping policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Create a single consolidated policy
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Fix get_user_company_id function
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = user_id;
$$;

-- Fix get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_profiles WHERE id = user_id;
$$;

-- Fix update_fundraising_credits_updated_at function
CREATE OR REPLACE FUNCTION public.update_fundraising_credits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- 5. DROP UNUSED INDEXES TO SAVE SPACE
-- =====================================================

-- Drop indexes that are confirmed unused and redundant
-- Note: Being cautious - only dropping truly redundant indexes

-- Drop redundant foreign key indexes that duplicate primary key indexes
DROP INDEX IF EXISTS idx_quote_fees_quote_id_fk;
DROP INDEX IF EXISTS idx_quote_imprints_quote_id_fk;
DROP INDEX IF EXISTS idx_quote_items_quote_id_fk;

-- Drop redundant company_id indexes where composite indexes exist
DROP INDEX IF EXISTS idx_stripe_payment_intents_company_id;
DROP INDEX IF EXISTS idx_stripe_payment_links_company_id_fk;
DROP INDEX IF EXISTS idx_stripe_payment_history_invoice_id_fk;

-- Note: Keeping indexes that may be used in future or provide query optimization:
-- - idx_user_profiles_company_id_fk (used for company isolation queries)
-- - idx_fundraising_credits_customer_id (used for customer lookups)
-- - idx_billing_attempts_* (may be used for billing queue processing)
-- - idx_*_company_id_fk (used for company isolation, critical for security)

-- =====================================================
-- 6. ADD HELPER FUNCTION FOR SUPER ADMIN CHECK
-- =====================================================

-- Create a helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = user_id AND role = 'super_admin'
  );
$$;

-- =====================================================
-- NOTES ON ISSUES NOT FIXED IN THIS MIGRATION
-- =====================================================

/*
  Issues that cannot be fixed via SQL migration:
  
  1. Auth DB Connection Strategy
     - Requires Supabase dashboard configuration
     - Navigate to Project Settings > Database > Connection pooling
     - Change from fixed number to percentage-based allocation
  
  2. Leaked Password Protection
     - Requires Supabase Auth configuration
     - Navigate to Authentication > Providers > Email
     - Enable "Check for leaked passwords"
  
  3. "Always True" Policies on System Tables
     - companies: "System can insert companies" - INTENTIONAL
       Required for signup flow to create new company
     - printavo_statuses: Global statuses shared across system
       These are reference data tables, not user data
*/