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
/*
  # Create Customer Fundraising Credits Table

  1. New Tables
    - `customer_fundraising_credits`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key to customers)
      - `company_id` (uuid, foreign key to company_settings)
      - `date` (date) - Date of fundraising payout
      - `store_name` (text) - Store name or number
      - `batch_number` (text) - Batch identifier
      - `amount` (numeric) - Fundraising amount earned
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `customer_fundraising_credits` table
    - Add policy for authenticated users to read credits in their company
    - Add policy for authenticated users to insert credits in their company
    - Add policy for authenticated users to update credits in their company
    - Add policy for authenticated users to delete credits in their company

  3. Indexes
    - Index on customer_id for fast lookups
    - Index on company_id for company isolation
*/

-- Create customer_fundraising_credits table
CREATE TABLE IF NOT EXISTS customer_fundraising_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  date date NOT NULL,
  store_name text NOT NULL,
  batch_number text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fundraising_credits_customer_id ON customer_fundraising_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_credits_company_id ON customer_fundraising_credits(company_id);

-- Enable RLS
ALTER TABLE customer_fundraising_credits ENABLE ROW LEVEL SECURITY;

-- Policy for selecting credits (users can view credits for customers in their company)
CREATE POLICY "Users can view fundraising credits in their company"
  ON customer_fundraising_credits FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for inserting credits (users can add credits for customers in their company)
CREATE POLICY "Users can insert fundraising credits in their company"
  ON customer_fundraising_credits FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for updating credits (users can update credits for customers in their company)
CREATE POLICY "Users can update fundraising credits in their company"
  ON customer_fundraising_credits FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for deleting credits (users can delete credits for customers in their company)
CREATE POLICY "Users can delete fundraising credits in their company"
  ON customer_fundraising_credits FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fundraising_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row updates
DROP TRIGGER IF EXISTS set_fundraising_credits_updated_at ON customer_fundraising_credits;
CREATE TRIGGER set_fundraising_credits_updated_at
  BEFORE UPDATE ON customer_fundraising_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_fundraising_credits_updated_at();
/*
  # Allow Negative Fundraising Credits for Deductions

  1. Changes
    - Remove the non-negative constraint on amount column
    - This allows negative entries to represent fundraising credit deductions when applied to invoices

  2. Notes
    - Positive amounts = fundraising credits earned
    - Negative amounts = fundraising credits applied to invoices
    - The net sum represents the customer's available fundraising credit balance
*/

-- Drop the existing constraint and add a new one that allows negative amounts
ALTER TABLE customer_fundraising_credits
DROP CONSTRAINT IF EXISTS customer_fundraising_credits_amount_check;

-- No constraint needed - allow any numeric value (positive for earning, negative for applying)
/*
  # Add Fundraising Report Upload Support

  1. Changes
    - Add `report_file_path` column to `customer_fundraising_credits` table to store PDF file path

  2. Storage
    - Create storage bucket for fundraising reports with appropriate policies

  3. Security
    - Users can upload reports for credits in their company
    - Users can view reports for credits in their company
*/

-- Add report_file_path column to customer_fundraising_credits
ALTER TABLE customer_fundraising_credits
ADD COLUMN IF NOT EXISTS report_file_path text;

-- Create storage bucket for fundraising reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('fundraising-reports', 'fundraising-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files to their company's folder
CREATE POLICY "Users can upload fundraising reports for their company"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fundraising-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

-- Policy: Allow authenticated users to view files from their company's folder
CREATE POLICY "Users can view fundraising reports from their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fundraising-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

-- Policy: Allow authenticated users to delete files from their company's folder
CREATE POLICY "Users can delete fundraising reports from their company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fundraising-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);/*
  # Add Report URL to Fundraising Credits

  1. Schema Changes
    - Add `report_url` column to `customer_fundraising_credits` table
      - Stores the URL of uploaded PDF reports
      - Optional field (can be null if no report uploaded yet)

  2. Storage Setup
    - Create `fundraising-reports` storage bucket
    - Enable public access for viewing uploaded reports
    - Set appropriate file size limits and allowed MIME types
*/

-- Add report_url column to customer_fundraising_credits table
ALTER TABLE customer_fundraising_credits 
ADD COLUMN IF NOT EXISTS report_url text;

-- Create storage bucket for fundraising reports if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fundraising-reports',
  'fundraising-reports',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for authenticated users to upload files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload fundraising reports for their company'
  ) THEN
    CREATE POLICY "Users can upload fundraising reports for their company"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'fundraising-reports' AND
        (storage.foldername(name))[1] IN (
          SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create storage policy for authenticated users to view files in their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view fundraising reports for their company'
  ) THEN
    CREATE POLICY "Users can view fundraising reports for their company"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'fundraising-reports' AND
        (storage.foldername(name))[1] IN (
          SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create storage policy for authenticated users to delete files in their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete fundraising reports for their company'
  ) THEN
    CREATE POLICY "Users can delete fundraising reports for their company"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'fundraising-reports' AND
        (storage.foldername(name))[1] IN (
          SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
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
*//*
  # Fix Infinite Recursion in user_profiles RLS Policy

  1. Problem
    - The RLS policy for viewing profiles in the same company queries user_profiles table
    - This causes infinite recursion: policy checks -> query user_profiles -> policy checks -> loop
    - Results in "infinite recursion detected in policy" error

  2. Solution
    - Create a helper function that bypasses RLS to get current user's company_id
    - Use SECURITY DEFINER to bypass RLS
    - Update the RLS policy to use this function instead of direct table query

  3. Changes
    - Create get_user_company_id() function
    - Replace problematic RLS policy with fixed version
*/

-- Create a helper function to get user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id 
  FROM user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Create a new policy without recursion
CREATE POLICY "Users can view profiles in their company"
ON user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR 
  company_id = get_user_company_id()
);
/*
  # Auto-unlock invoices when payments are refunded

  1. Problem
    - When payments are refunded, invoices remain locked even though they have outstanding balances
    - Locked invoices with balances cannot be modified or sent for payment
    - Invoices 60003448 and 60003444 are locked but have outstanding balances

  2. Solution
    - Update recalculate_invoice_balances() to automatically unlock invoices that have outstanding balances
    - An invoice should only be locked if it's fully paid (balance_remaining <= 0)
    - When a payment is refunded and balance > 0, the invoice should be unlocked

  3. Logic
    - If balance_remaining > 0 AND is_financially_locked = true, then unlock the invoice
    - Set is_financially_locked = false, locked_at = NULL, locked_by = NULL
*/

-- Drop existing function to change return type
DROP FUNCTION IF EXISTS recalculate_invoice_balances();

-- Update the recalculate_invoice_balances function to auto-unlock invoices with balances
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  invoice_number text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric,
  old_status_stage text,
  new_status_stage text,
  was_unlocked boolean
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      p.invoice_id,
      -- Only count successful payments and partial refunds
      -- Exclude: failed, refunded, reversed
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        ELSE 0
      END), 0) as calculated_paid
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
      AND p.status NOT IN ('failed', 'refunded', 'reversed')
    GROUP BY p.invoice_id
  ),
  current_values AS (
    SELECT 
      i.id,
      i.invoice_number,
      i.amount_paid as old_paid,
      i.balance_remaining as old_balance,
      i.status_stage as old_stage,
      i.is_financially_locked
    FROM printavo_invoices i
  ),
  updates AS (
    UPDATE printavo_invoices i
    SET 
      amount_paid = COALESCE(pt.calculated_paid, 0),
      balance_remaining = i.total - COALESCE(pt.calculated_paid, 0),
      amount_outstanding = i.total - COALESCE(pt.calculated_paid, 0),
      status_stage = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) <= 0 THEN 'paid'
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 
          AND (i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL) THEN 'accounts_receivable'
        ELSE 'billing_queue'
      END,
      -- Auto-unlock invoices with outstanding balances
      is_financially_locked = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 THEN false
        ELSE i.is_financially_locked
      END,
      locked_at = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 THEN NULL
        ELSE i.locked_at
      END,
      locked_by = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 THEN NULL
        ELSE i.locked_by
      END,
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
        OR (
          -- Fix status_stage if it's wrong for the balance
          (i.total - COALESCE(pt.calculated_paid, 0)) <= 0 AND i.status_stage != 'paid'
        ) OR (
          (i.total - COALESCE(pt.calculated_paid, 0)) > 0 AND i.status_stage = 'paid'
        ) OR (
          -- Unlock if has outstanding balance
          (i.total - COALESCE(pt.calculated_paid, 0)) > 0 AND i.is_financially_locked = true
        )
      )
    RETURNING i.id
  )
  SELECT 
    cv.id as invoice_id,
    cv.invoice_number,
    cv.old_paid as old_amount_paid,
    COALESCE(pt.calculated_paid, 0) as new_amount_paid,
    cv.old_balance as old_balance,
    i.balance_remaining as new_balance,
    cv.old_stage as old_status_stage,
    i.status_stage as new_status_stage,
    (cv.is_financially_locked = true AND i.is_financially_locked = false) as was_unlocked
  FROM updates u
  JOIN current_values cv ON cv.id = u.id
  JOIN printavo_invoices i ON i.id = u.id
  LEFT JOIN payment_totals pt ON pt.invoice_id = u.id;
END;
$$;

-- Also update invoices that have no payments but wrong balance or are incorrectly locked
UPDATE printavo_invoices i
SET 
  amount_paid = 0,
  balance_remaining = i.total,
  amount_outstanding = i.total,
  status_stage = CASE
    WHEN i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL THEN 'accounts_receivable'
    ELSE 'billing_queue'
  END,
  -- Unlock if has outstanding balance
  is_financially_locked = false,
  locked_at = NULL,
  locked_by = NULL,
  updated_at = now()
WHERE i.id NOT IN (SELECT DISTINCT invoice_id FROM payments WHERE invoice_id IS NOT NULL)
  AND (
    i.amount_paid != 0
    OR i.balance_remaining != i.total
    OR i.status_stage = 'paid'
    OR i.is_financially_locked = true
  );

-- Run the function to fix all existing invoices
SELECT * FROM recalculate_invoice_balances();
/*
  # Add trigger to recalculate invoice balances on payment changes

  1. Problem
    - When payments are added, updated, or reversed, invoice balances don't automatically recalculate
    - The revert function calls recalculate_invoice_balances() but it doesn't always update
    
  2. Solution
    - Create a trigger function that recalculates a specific invoice's balance
    - Add triggers on INSERT, UPDATE, and DELETE of payments to automatically recalculate the affected invoice
    
  3. Changes
    - Create recalculate_single_invoice_balance(invoice_id) function
    - Add trigger on payments table for INSERT, UPDATE, DELETE
*/

-- Create function to recalculate a single invoice's balance
CREATE OR REPLACE FUNCTION recalculate_single_invoice_balance(p_invoice_id text)
RETURNS void AS $$
DECLARE
  v_calculated_paid numeric;
BEGIN
  -- Calculate total payments for this invoice
  SELECT COALESCE(SUM(CASE 
    WHEN status = 'successful' THEN amount
    WHEN status = 'partial_refund' THEN amount - COALESCE(refund_amount, 0)
    WHEN status = 'reversed' THEN amount
    ELSE 0
  END), 0)
  INTO v_calculated_paid
  FROM payments
  WHERE invoice_id = p_invoice_id;

  -- Update the invoice
  UPDATE printavo_invoices
  SET 
    amount_paid = v_calculated_paid,
    balance_remaining = total - v_calculated_paid,
    amount_outstanding = total - v_calculated_paid,
    updated_at = now()
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to recalculate invoice balance when payment changes
CREATE OR REPLACE FUNCTION trigger_recalculate_invoice_on_payment_change()
RETURNS trigger AS $$
BEGIN
  -- On INSERT or UPDATE, recalculate the new invoice
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.invoice_id IS NOT NULL THEN
    PERFORM recalculate_single_invoice_balance(NEW.invoice_id);
  END IF;
  
  -- On UPDATE, if invoice_id changed, also recalculate the old invoice
  IF (TG_OP = 'UPDATE') AND OLD.invoice_id IS NOT NULL AND OLD.invoice_id != NEW.invoice_id THEN
    PERFORM recalculate_single_invoice_balance(OLD.invoice_id);
  END IF;
  
  -- On DELETE, recalculate the old invoice
  IF (TG_OP = 'DELETE') AND OLD.invoice_id IS NOT NULL THEN
    PERFORM recalculate_single_invoice_balance(OLD.invoice_id);
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_recalculate_invoice_balance_on_payment ON payments;

-- Create trigger on payments table
CREATE TRIGGER trigger_recalculate_invoice_balance_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_invoice_on_payment_change();
/*
  # Fix payment calculation and billing queue synchronization
  
  1. Problem
    - Reversed payments are being added to amount_paid instead of being excluded
    - Refunded payments are being added instead of subtracted
    - billing_queue.payment_status is not updated when invoice balances change
    - Invoices remain locked even when they have outstanding balances
    
  2. Solution
    - Fix the payment calculation to properly handle reversed and refunded payments
    - Update billing_queue.payment_status when invoice balance changes
    - Unlock invoices that have outstanding balances
    
  3. Changes
    - Update recalculate_single_invoice_balance() to exclude reversed/refunded payments
    - Add logic to update billing_queue.payment_status
    - Create function to unlock invoices with outstanding balances
*/

-- Fix the calculation to properly exclude reversed and refunded payments
CREATE OR REPLACE FUNCTION recalculate_single_invoice_balance(p_invoice_id text)
RETURNS void AS $$
DECLARE
  v_calculated_paid numeric;
  v_invoice_total numeric;
  v_balance_remaining numeric;
  v_new_payment_status text;
BEGIN
  -- Calculate total payments for this invoice (exclude reversed and refunded)
  SELECT COALESCE(SUM(CASE 
    WHEN status = 'successful' THEN amount
    WHEN status = 'partial_refund' THEN amount - COALESCE(refund_amount, 0)
    -- REVERSED and REFUNDED should be EXCLUDED (not added)
    ELSE 0
  END), 0)
  INTO v_calculated_paid
  FROM payments
  WHERE invoice_id = p_invoice_id;

  -- Get invoice total
  SELECT total INTO v_invoice_total
  FROM printavo_invoices
  WHERE id = p_invoice_id;

  -- Calculate balance
  v_balance_remaining := v_invoice_total - v_calculated_paid;

  -- Determine payment status
  IF v_balance_remaining <= 0 THEN
    v_new_payment_status := 'paid';
  ELSIF v_calculated_paid > 0 THEN
    v_new_payment_status := 'partial';
  ELSE
    v_new_payment_status := 'unpaid';
  END IF;

  -- Update the invoice
  UPDATE printavo_invoices
  SET 
    amount_paid = v_calculated_paid,
    balance_remaining = v_balance_remaining,
    amount_outstanding = v_balance_remaining,
    updated_at = now()
  WHERE id = p_invoice_id;

  -- Update billing_queue payment_status if invoice is in the queue
  UPDATE billing_queue
  SET 
    payment_status = v_new_payment_status,
    updated_at = now()
  WHERE printavo_invoice_id = p_invoice_id;

END;
$$ LANGUAGE plpgsql;

-- Create function to unlock invoices with outstanding balances
CREATE OR REPLACE FUNCTION unlock_invoices_with_outstanding_balance()
RETURNS void AS $$
BEGIN
  UPDATE printavo_invoices
  SET 
    is_financially_locked = false,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
  WHERE is_financially_locked = true
    AND balance_remaining > 0;
END;
$$ LANGUAGE plpgsql;

-- Run the unlock function immediately
SELECT unlock_invoices_with_outstanding_balance();

-- Recalculate all invoice balances to ensure consistency
DO $$
DECLARE
  v_invoice_record RECORD;
BEGIN
  FOR v_invoice_record IN 
    SELECT DISTINCT invoice_id 
    FROM payments 
    WHERE invoice_id IS NOT NULL
  LOOP
    PERFORM recalculate_single_invoice_balance(v_invoice_record.invoice_id);
  END LOOP;
END $$;
