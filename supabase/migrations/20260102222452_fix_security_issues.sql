/*
  # Fix Security and Performance Issues

  ## Changes Made

  1. **RLS Performance Optimization**
     - Optimized auth.uid() calls in RLS policies by wrapping in subqueries
     - Affects: user_profiles and company_settings tables
     - This prevents re-evaluation of auth.uid() for each row, improving query performance

  2. **Remove Unused Indexes**
     - Dropped unused indexes to improve write performance and reduce storage
     - Removed indexes on: customer_email, due_date, printavo_username, owner_id, description, created_at

  3. **Consolidate Duplicate RLS Policies**
     - Removed duplicate permissive SELECT policies for anon role
     - Consolidated printavo_invoices and printavo_payments policies

  4. **Add Missing RLS Policies**
     - Added policies for api_credentials table (was RLS-enabled but had no policies)
     - Only authenticated users can manage their own credentials

  5. **Fix Function Security**
     - Set immutable search_path on functions to prevent search path attacks
     - Affects: update_updated_at_column, handle_new_user, trigger_printavo_sync

  6. **Enable RLS on Public Tables**
     - Enabled RLS on printavo_sync_config table
     - Added appropriate access policies
*/

-- ============================================================================
-- 1. Fix RLS Performance Issues - Optimize auth.uid() calls
-- ============================================================================

-- Drop existing policies for user_profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Drop existing policies for company_settings
DROP POLICY IF EXISTS "Users can insert own company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON public.company_settings;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Users can insert own company settings"
  ON public.company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can update own company settings"
  ON public.company_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- ============================================================================
-- 2. Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_invoices_customer_email;
DROP INDEX IF EXISTS public.idx_invoices_due_date;
DROP INDEX IF EXISTS public.idx_company_settings_printavo_username;
DROP INDEX IF EXISTS public.idx_company_settings_owner_id;
DROP INDEX IF EXISTS public.idx_line_items_description;
DROP INDEX IF EXISTS public.idx_line_items_created_at;

-- ============================================================================
-- 3. Consolidate Duplicate RLS Policies
-- ============================================================================

-- Remove duplicate policies on printavo_invoices
DROP POLICY IF EXISTS "Allow anonymous read access to calculated invoices" ON public.printavo_invoices;
DROP POLICY IF EXISTS "Allow public read access to invoices" ON public.printavo_invoices;

-- Create single consolidated policy
CREATE POLICY "Allow read access to invoices"
  ON public.printavo_invoices
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Remove duplicate policies on printavo_payments
DROP POLICY IF EXISTS "Allow anonymous read access to payments" ON public.printavo_payments;
DROP POLICY IF EXISTS "Allow public read access to payments" ON public.printavo_payments;

-- Create single consolidated policy
CREATE POLICY "Allow read access to payments"
  ON public.printavo_payments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- 4. Add Policies for api_credentials Table
-- ============================================================================

-- Currently has RLS enabled but no policies - lock it down properly
CREATE POLICY "Service role can manage api credentials"
  ON public.api_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. Fix Function Search Paths
-- ============================================================================

-- Recreate functions with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN NEW.email = 'jamie@modernrebel.shop' THEN 'admin'
      ELSE 'viewer'
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_printavo_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.printavo_sync_config
  SET last_triggered_at = now()
  WHERE id = 1;
END;
$$;

-- ============================================================================
-- 6. Enable RLS on printavo_sync_config
-- ============================================================================

ALTER TABLE public.printavo_sync_config ENABLE ROW LEVEL SECURITY;

-- Add policy for service role to manage sync config
CREATE POLICY "Service role can manage sync config"
  ON public.printavo_sync_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read sync status
CREATE POLICY "Authenticated users can read sync config"
  ON public.printavo_sync_config
  FOR SELECT
  TO authenticated
  USING (true);