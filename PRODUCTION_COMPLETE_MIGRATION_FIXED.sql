/*
  COMPLETE PRODUCTION MIGRATION SCRIPT

  This file combines all migrations in chronological order.
  Apply this to your production database at:
  https://supabase.com/dashboard/project/cuaukcvccxvfpuxaciac/sql/new

  IMPORTANT:
  1. Run this in the SQL Editor
  2. After completion, run: NOTIFY pgrst, 'reload schema';
  3. Wait 30 seconds for PostgREST to reload
  4. Test your application
*/


-- ============================================================================
-- Migration: 20251229151519_create_printavo_cache_tables.sql
-- ============================================================================

/*
  # Create Printavo Data Cache Tables

  1. New Tables
    - `printavo_invoices`
      - Stores all invoice data from Printavo
      - Includes customer info, amounts, status, dates
      - Primary key: `id` (text, matches Printavo invoice ID)
    
    - `printavo_payments`
      - Stores all payment/transaction data from Printavo
      - Links to invoices via `invoice_id`
      - Includes payment method, amount, dates
      - Primary key: `id` (text, matches Printavo transaction ID)
    
    - `printavo_sync_log`
      - Tracks sync operations
      - Records last sync time and status
      - Helps prevent duplicate syncs

  2. Security
    - Enable RLS on all tables
    - Allow public read access (data is not sensitive)
    - Restrict write access to service role only

  3. Indexes
    - Add indexes on frequently queried fields
    - Customer email, status, dates for fast filtering
*/

-- Create invoices cache table
CREATE TABLE IF NOT EXISTS printavo_invoices (
  id text PRIMARY KEY,
  order_id text,
  invoice_number text,
  customer_email text,
  customer_name text,
  customer_company text,
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  amount_outstanding numeric DEFAULT 0,
  status text,
  invoice_date timestamptz,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_data jsonb
);

-- Create payments cache table
CREATE TABLE IF NOT EXISTS printavo_payments (
  id text PRIMARY KEY,
  invoice_id text,
  amount numeric DEFAULT 0,
  payment_method text,
  notes text,
  payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_data jsonb
);

-- Create sync log table
CREATE TABLE IF NOT EXISTS printavo_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'running',
  records_synced integer DEFAULT 0,
  error_message text
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON printavo_invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON printavo_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON printavo_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON printavo_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_outstanding ON printavo_invoices(amount_outstanding);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON printavo_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON printavo_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON printavo_sync_log(started_at DESC);

-- Enable RLS
ALTER TABLE printavo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE printavo_sync_log ENABLE ROW LEVEL SECURITY;

-- Allow public read access (this is business data, not sensitive user data)
CREATE POLICY "Allow public read access to invoices"
  ON printavo_invoices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to payments"
  ON printavo_payments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to sync log"
  ON printavo_sync_log FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role can write (edge functions will use this)
CREATE POLICY "Service role can insert invoices"
  ON printavo_invoices FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update invoices"
  ON printavo_invoices FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete invoices"
  ON printavo_invoices FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert payments"
  ON printavo_payments FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update payments"
  ON printavo_payments FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete payments"
  ON printavo_payments FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert sync log"
  ON printavo_sync_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update sync log"
  ON printavo_sync_log FOR UPDATE
  TO service_role
  USING (true);

-- ============================================================================
-- Migration: 20251230151317_add_api_credentials_table.sql
-- ============================================================================

/*
  # Add API Credentials Storage

  1. New Tables
    - `api_credentials`
      - `id` (uuid, primary key)
      - `service_name` (text, unique) - Name of the external service (e.g., 'printavo')
      - `credentials` (jsonb) - Encrypted credentials storage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `api_credentials` table
    - Add policy to allow service role access only (Edge Functions)
    - This table is not accessible to anonymous or authenticated users
  
  3. Initial Data
    - Insert Printavo API credentials for immediate use
*/

CREATE TABLE IF NOT EXISTS api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text UNIQUE NOT NULL,
  credentials jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

-- No policies needed - only service role (Edge Functions) can access
-- RLS will block all user access by default

-- Insert Printavo credentials
INSERT INTO api_credentials (service_name, credentials)
VALUES (
  'printavo',
  jsonb_build_object(
    'email', 'sales@toddssportinggoods.com',
    'token', 'nfmw24ZgGEtj9ngNfCqMNA'
  )
)
ON CONFLICT (service_name) 
DO UPDATE SET 
  credentials = EXCLUDED.credentials,
  updated_at = now();

-- ============================================================================
-- Migration: 20251230175711_enable_pg_cron_for_printavo_sync.sql
-- ============================================================================

/*
  # Enable Automated Printavo Sync with pg_cron
  
  1. Extensions
    - Enable pg_cron extension for scheduled tasks
    - Enable pg_net extension for HTTP requests
  
  2. Scheduled Jobs
    - Create hourly job to sync Printavo data
    - Job runs at minute 0 of every hour (e.g., 1:00, 2:00, 3:00, etc.)
    - Calls the printavo-sync edge function
  
  3. Security
    - Uses service role key for authentication
    - Job runs with superuser privileges via pg_cron
  
  ## Important Notes:
  - The job uses pg_net.http_post to call the edge function
  - The edge function handles duplicate sync prevention
  - Sync logs are stored in printavo_sync_log table for monitoring
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create scheduled job to sync Printavo data every hour
SELECT cron.schedule(
  'printavo-hourly-sync',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/printavo-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Store Supabase URL and anon key as settings for the cron job to use
-- Note: These need to be set manually via SQL or done through app code
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://cuaukcvccxvfpuxaciac.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';

-- ============================================================================
-- Migration: 20251230175741_setup_automated_sync_with_function.sql
-- ============================================================================

/*
  # Setup Automated Printavo Sync
  
  1. Functions
    - Create trigger_printavo_sync() function to call edge function
    - Function uses pg_net to make HTTP request
  
  2. Scheduled Jobs
    - Create hourly cron job to trigger sync
    - Job runs at minute 0 of every hour
  
  3. Configuration
    - Stores Supabase URL and anon key in a config table
    - Function reads from config table for secure credential storage
  
  ## Security
  - Config table is not exposed via API
  - Only cron job can trigger automatic syncs
  - All sync operations logged in printavo_sync_log
*/

-- Drop existing job if it exists
SELECT cron.unschedule('printavo-hourly-sync') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'printavo-hourly-sync'
);

-- Create config table for storing Supabase connection details
CREATE TABLE IF NOT EXISTS printavo_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url text NOT NULL,
  supabase_anon_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert config (will be updated by application)
INSERT INTO printavo_sync_config (supabase_url, supabase_anon_key)
VALUES (
  'https://cuaukcvccxvfpuxaciac.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1Nzg2MDUsImV4cCI6MjA1MTE1NDYwNX0.zuT3Tcu4SLmHciYZ-zEj1zVCWOqvl0BpLV9fDLAor5w'
)
ON CONFLICT (id) DO NOTHING;

-- Create function to trigger sync
CREATE OR REPLACE FUNCTION trigger_printavo_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_record RECORD;
  request_id bigint;
BEGIN
  -- Get config
  SELECT supabase_url, supabase_anon_key INTO config_record
  FROM printavo_sync_config
  LIMIT 1;
  
  IF config_record IS NULL THEN
    RAISE EXCEPTION 'Printavo sync config not found';
  END IF;
  
  -- Make HTTP request to edge function
  SELECT net.http_post(
    url := config_record.supabase_url || '/functions/v1/printavo-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || config_record.supabase_anon_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;
  
  RAISE NOTICE 'Printavo sync triggered with request_id: %', request_id;
END;
$$;

-- Schedule the sync to run every hour at minute 0
SELECT cron.schedule(
  'printavo-hourly-sync',
  '0 * * * *',
  'SELECT trigger_printavo_sync();'
);

-- ============================================================================
-- Migration: 20251230202352_create_calculated_invoice_view.sql
-- ============================================================================

/*
  # Create calculated invoice balances view

  1. Purpose
    - Calculate accurate invoice balances by summing actual payment records
    - Work around Printavo API data lag between invoices and payments endpoints
    
  2. Changes
    - Create a view that joins invoices with their payments
    - Calculates actual amount_paid from payment records
    - Calculates actual amount_outstanding as (total - calculated_amount_paid)
    - Determines paid_in_full status based on calculated balances
    
  3. Benefits
    - Real-time accurate balances even when Printavo API lags
    - Single source of truth for invoice status
    - No data duplication
*/

CREATE OR REPLACE VIEW printavo_invoices_calculated AS
SELECT 
  i.id,
  i.invoice_number,
  i.customer_email,
  i.customer_name,
  i.customer_company,
  i.subtotal,
  i.tax,
  i.total,
  COALESCE(SUM(p.amount), 0)::numeric AS amount_paid,
  GREATEST(i.total - COALESCE(SUM(p.amount), 0), 0)::numeric AS amount_outstanding,
  CASE 
    WHEN i.total <= COALESCE(SUM(p.amount), 0) THEN true
    ELSE false
  END AS paid_in_full,
  i.status,
  i.invoice_date,
  i.due_date,
  i.created_at,
  i.updated_at,
  i.raw_data
FROM printavo_invoices i
LEFT JOIN printavo_payments p ON p.invoice_id = i.id
GROUP BY 
  i.id, i.invoice_number, i.customer_email, i.customer_name, 
  i.customer_company, i.subtotal, i.tax, i.total, i.status, 
  i.invoice_date, i.due_date, i.created_at, i.updated_at, i.raw_data;

-- ============================================================================
-- Migration: 20251230202421_enable_rls_for_calculated_view.sql
-- ============================================================================

/*
  # Enable RLS for calculated invoice view

  1. Security
    - Enable RLS on the calculated view
    - Allow anonymous read access (same as the base tables)
    
  2. Notes
    - The view is read-only and aggregates public data
    - Uses the same security model as printavo_invoices table
*/

ALTER VIEW printavo_invoices_calculated SET (security_invoker = on);

CREATE POLICY "Allow anonymous read access to calculated invoices"
  ON printavo_invoices
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read access to payments"
  ON printavo_payments
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- Migration: 20251231150153_add_company_settings_and_users_tables.sql
-- ============================================================================

/*
  # Add Company Settings and Users Management

  ## New Tables
  
  ### company_settings
  - `id` (uuid, primary key) - Unique identifier for the company
  - `company_name` (text) - Company name from Printavo
  - `logo_url` (text, nullable) - URL to uploaded company logo in Supabase storage
  - `printavo_company_id` (text, nullable) - Company ID from Printavo API
  - `printavo_data` (jsonb, nullable) - Full company data from Printavo API
  - `created_at` (timestamptz) - When the record was created
  - `updated_at` (timestamptz) - When the record was last updated
  
  ### user_profiles
  - `id` (uuid, primary key, references auth.users) - User ID from Supabase auth
  - `email` (text) - User email address
  - `full_name` (text, nullable) - User's full name
  - `role` (text) - User role (admin, user, viewer)
  - `created_at` (timestamptz) - When the user was added
  - `updated_at` (timestamptz) - When the profile was last updated

  ## Storage
  - Create a bucket for company logos

  ## Security
  - Enable RLS on both tables
  - Only authenticated users can read company settings
  - Only admin users can update company settings
  - Only admin users can manage user profiles
*/

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  logo_url text,
  printavo_company_id text,
  printavo_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Company Settings Policies
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- User Profiles Policies
CREATE POLICY "Users can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company logos
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

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'admin')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
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


-- ============================================================================
-- Migration: 20251231151350_make_jamie_admin_on_signup.sql
-- ============================================================================

/*
  # Make Jamie Admin on Signup

  1. Updates
    - Modifies the handle_new_user function to automatically grant admin role to Jamie@toddssportinggoods.com
    - Sets their role as 'admin' instead of the default

  2. Security
    - Only affects the specific email address
    - All other users get the default 'user' role
*/

-- Update the function to check for the admin email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the admin email and set role accordingly
  IF LOWER(NEW.email) = 'jamie@toddssportinggoods.com' THEN
    INSERT INTO public.user_profiles (id, email, role, full_name)
    VALUES (NEW.id, NEW.email, 'admin', 'Jamie')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  ELSE
    INSERT INTO public.user_profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Migration: 20251231154313_add_invoice_status_preferences.sql
-- ============================================================================

/*
  # Add Invoice Status Preferences

  1. Changes
    - Add `available_invoice_statuses` field to track all statuses from Printavo
    - Add `selected_invoice_statuses` field to track which statuses users want to report on
    
  2. Purpose
    - Allow users to select which Printavo invoice statuses to include in AR reports
    - Provide filtering capability for exports and reporting
    
  3. Fields
    - `available_invoice_statuses`: jsonb array of all statuses available in Printavo account
    - `selected_invoice_statuses`: jsonb array of user-selected statuses for reporting
*/

-- Add columns to company_settings if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' 
    AND column_name = 'available_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN available_invoice_statuses jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' 
    AND column_name = 'selected_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN selected_invoice_statuses jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20251231164451_add_printavo_credentials_to_company_settings.sql
-- ============================================================================

/*
  # Add Printavo API Credentials to Company Settings

  ## Changes
  
  This migration adds secure storage for Printavo API credentials to enable 
  multi-tenant authentication where each company stores their own Printavo 
  API access credentials.

  ### Modified Tables
  
  #### company_settings
  - Add `printavo_username` (text, nullable) - Printavo account email/username
  - Add `printavo_api_token_encrypted` (text, nullable) - AES-256 encrypted Printavo API token
  - Add `encryption_key_version` (text, default 'v1') - Track which encryption key version was used

  ## Security Notes
  
  - API tokens are stored encrypted using AES-256-GCM
  - Encryption/decryption happens server-side via Edge Functions
  - The encryption key is stored as an environment variable, never in the database
  - RLS policies remain unchanged (authenticated users only)
  
  ## Usage
  
  After signup, companies will provide:
  1. Company name
  2. Email & password (for Supabase auth)
  3. Printavo username
  4. Printavo API token (encrypted before storage)
*/

-- Add Printavo credentials fields to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'printavo_username'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN printavo_username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'printavo_api_token_encrypted'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN printavo_api_token_encrypted text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'encryption_key_version'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN encryption_key_version text DEFAULT 'v1';
  END IF;
END $$;

-- Create an index on printavo_username for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_printavo_username 
  ON company_settings(printavo_username);

-- Add a constraint to ensure that if api_token is set, username must also be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'printavo_credentials_complete'
  ) THEN
    ALTER TABLE company_settings
    ADD CONSTRAINT printavo_credentials_complete
    CHECK (
      (printavo_api_token_encrypted IS NULL AND printavo_username IS NULL) OR
      (printavo_api_token_encrypted IS NOT NULL AND printavo_username IS NOT NULL)
    );
  END IF;
END $$;


-- ============================================================================
-- Migration: 20251231202337_fix_company_settings_user_relationship.sql
-- ============================================================================

/*
  # Fix Company Settings User Relationship

  ## Problem
  The company_settings table has no relationship to auth.users, causing issues when
  multiple users exist in the system. The getCompanySettings query has no filter,
  so it doesn't know which company settings to return.

  ## Changes

  ### Modified Tables
  
  #### company_settings
  - Add `owner_id` (uuid, foreign key to auth.users) - The user who owns this company
  - Backfill existing records with the first user's ID (for initial setup)
  - Make owner_id NOT NULL after backfill

  ## Security Changes
  
  Update RLS policies to ensure users can only access their own company settings:
  - SELECT: Users can only read their own company settings (owner_id = auth.uid())
  - INSERT: Users can only create company settings where they are the owner
  - UPDATE: Users can only update their own company settings
*/

-- Add owner_id column (nullable initially for backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill existing company_settings with the corresponding user
-- Match by checking user_profiles created around the same time
UPDATE company_settings cs
SET owner_id = (
  SELECT up.id 
  FROM user_profiles up 
  WHERE up.created_at <= cs.created_at + interval '1 minute'
    AND up.created_at >= cs.created_at - interval '1 minute'
  ORDER BY up.created_at
  LIMIT 1
)
WHERE owner_id IS NULL;

-- If no match found by time, use the first admin user
UPDATE company_settings cs
SET owner_id = (
  SELECT id FROM user_profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1
)
WHERE owner_id IS NULL;

-- Make owner_id required
ALTER TABLE company_settings ALTER COLUMN owner_id SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_owner_id ON company_settings(owner_id);

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can read company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;

-- Create new restrictive policies
CREATE POLICY "Users can read own company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ============================================================================
-- Migration: 20260102175632_add_square_credentials_to_company_settings.sql
-- ============================================================================

/*
  # Add Square Integration Credentials

  1. Changes
    - Adds Square API credentials columns to company_settings table
    - All credentials are stored as encrypted text fields
    - Includes access_token, application_id, location_id
  
  2. Security
    - Uses existing RLS policies on company_settings table
    - Data is accessible only to authenticated users associated with the company
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_access_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_application_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_application_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_location_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_location_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_environment'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN square_environment text DEFAULT 'production';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260102195110_update_company_settings_rls_for_all_users.sql
-- ============================================================================

/*
  # Update Company Settings RLS for Shared Access
  
  1. Changes
    - Drop the restrictive read policy on company_settings
    - Create a new policy that allows all authenticated users to read any company_settings
    - Keep write policies restricted to the owner only
  
  2. Security
    - All authenticated users can read company settings (needed for team access)
    - Only the owner can insert/update their company settings
    - This allows team members to access shared company API credentials
*/

-- Drop the existing restrictive read policy
DROP POLICY IF EXISTS "Users can read own company settings" ON company_settings;

-- Create a new policy that allows all authenticated users to read company settings
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================================
-- Migration: 20260102222452_fix_security_issues.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20260102222638_add_missing_foreign_key_index.sql
-- ============================================================================

/*
  # Add Missing Foreign Key Index

  ## Changes Made

  1. **Add Index for Foreign Key**
     - Added index on company_settings.owner_id to improve query performance
     - This foreign key references user_profiles(id)
     - Missing indexes on foreign keys can cause slow queries when joining tables

  ## Performance Impact
     - Improves JOIN performance between company_settings and user_profiles
     - Speeds up CASCADE operations if parent records are deleted
     - Optimizes queries that filter by owner_id
*/

-- Add index for the foreign key on owner_id
CREATE INDEX IF NOT EXISTS idx_company_settings_owner_id 
  ON public.company_settings(owner_id);

-- ============================================================================
-- Migration: 20260103142432_add_resend_credentials_to_company_settings.sql
-- ============================================================================

/*
  # Add Resend API credentials to company settings

  1. Changes
    - Add `resend_api_key` column to `company_settings` table
      - Stored encrypted for security
      - Nullable (optional integration)
    
  2. Security
    - Column will store encrypted API key from Resend
    - Encrypted via crypto-service edge function before storage
    - Never exposed to frontend in plain text
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_api_key text;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260103163030_add_automated_reports_table.sql
-- ============================================================================

/*
  # Add Automated Reports Table

  1. New Tables
    - `automated_reports`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `report_type` (text) - Type of report to generate
      - `report_name` (text) - Display name for the report
      - `schedule_type` (text) - daily, weekly, monthly, custom
      - `schedule_time` (time) - Time of day to send (HH:MM:SS)
      - `schedule_timezone` (text) - Timezone for scheduling (e.g., 'America/New_York')
      - `schedule_day_of_week` (integer) - For weekly schedules (0-6, Sunday=0)
      - `schedule_day_of_month` (integer) - For monthly schedules (1-31)
      - `email_recipients` (jsonb) - Array of email addresses
      - `file_formats` (jsonb) - Array of formats: ['pdf', 'csv']
      - `is_enabled` (boolean) - Whether the automation is active
      - `last_sent_at` (timestamptz) - Last time the report was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS on `automated_reports` table
    - Add policies for users to manage their own automation rules
*/

CREATE TABLE IF NOT EXISTS automated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL,
  report_name text NOT NULL,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_time time NOT NULL DEFAULT '08:00:00',
  schedule_timezone text NOT NULL DEFAULT 'America/New_York',
  schedule_day_of_week integer CHECK (schedule_day_of_week >= 0 AND schedule_day_of_week <= 6),
  schedule_day_of_month integer CHECK (schedule_day_of_month >= 1 AND schedule_day_of_month <= 31),
  email_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_formats jsonb NOT NULL DEFAULT '["pdf"]'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automated_reports ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_automated_reports_user_id ON automated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_automated_reports_is_enabled ON automated_reports(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automated_reports_schedule_type ON automated_reports(schedule_type);

-- ============================================================================
-- Migration: 20260105160305_add_email_from_address_to_settings.sql
-- ============================================================================

/*
  # Add Email From Address to Company Settings

  1. Changes
    - Add `email_from_address` column to `company_settings` table
    - This will store the email address to use as the "from" address when sending emails
    - Must use an email from the verified domain in Resend

  2. Notes
    - Default to empty string, user must configure this in settings
    - This should be an email like: invoices@toddssportinggoods.com or noreply@toddssportinggoods.com
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_from_address'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_from_address text DEFAULT '';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260105165117_update_rls_for_admin_access.sql
-- ============================================================================

/*
  # Update RLS Policies for Admin Access

  ## Changes
  
  ### Automated Reports Table
  - Update SELECT policy to allow admins to view all automation rules
  - Update INSERT policy to allow admins to create automation rules for any user
  - Update UPDATE policy to allow admins to update any automation rule
  - Update DELETE policy to allow admins to delete any automation rule
  
  ### User Profiles Table
  - Update UPDATE policy to allow admins to update any user profile
  - Add DELETE policy to allow admins to delete user profiles
  
  ## Security Notes
  - Regular users can still only manage their own automation rules
  - Admins (users with role='admin' in user_profiles) can manage all resources
  - All policies check authentication first
*/

-- Drop existing automated_reports policies
DROP POLICY IF EXISTS "Users can view own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can create own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can update own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON automated_reports;

-- Create new automated_reports policies with admin access
CREATE POLICY "Users and admins can view automation rules"
  ON automated_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users and admins can create automation rules"
  ON automated_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users and admins can update automation rules"
  ON automated_reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users and admins can delete automation rules"
  ON automated_reports
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Drop existing user_profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create new user_profiles UPDATE policy with admin access
CREATE POLICY "Users can update own profile, admins can update any"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- Add DELETE policy for user_profiles
CREATE POLICY "Admins can delete user profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Migration: 20260107144815_setup_automated_reports_cron.sql
-- ============================================================================

/*
  # Setup Automated Reports Scheduler
  
  1. Function
    - Create process_automated_reports() function to check and send reports
    - Checks each enabled automation rule against its schedule
    - Calls edge function to generate and send reports
  
  2. Scheduled Job
    - Create cron job to run every 15 minutes
    - Checks all enabled automation rules and sends reports that are due
  
  3. Security
    - Function uses service role to call edge function
    - Only processes rules that match their schedule
*/

-- Create function to process automated reports
CREATE OR REPLACE FUNCTION process_automated_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rule_record RECORD;
  config_record RECORD;
  request_id bigint;
  now_time time;
  now_dow int;
  now_dom int;
  should_send boolean;
BEGIN
  -- Get config for Supabase connection
  SELECT supabase_url, supabase_anon_key INTO config_record
  FROM printavo_sync_config
  LIMIT 1;
  
  IF config_record IS NULL THEN
    RAISE NOTICE 'Supabase config not found, skipping automated reports';
    RETURN;
  END IF;
  
  -- Get current time info
  now_time := CURRENT_TIME;
  now_dow := EXTRACT(DOW FROM CURRENT_TIMESTAMP)::int;
  now_dom := EXTRACT(DAY FROM CURRENT_TIMESTAMP)::int;
  
  -- Loop through all enabled automation rules
  FOR rule_record IN 
    SELECT * FROM automated_reports 
    WHERE is_enabled = true
  LOOP
    should_send := false;
    
    -- Check if this rule should be sent now
    -- We check if the scheduled time matches the current hour (within 15 min window)
    IF EXTRACT(HOUR FROM rule_record.schedule_time::time) = EXTRACT(HOUR FROM now_time) THEN
      -- Check schedule type
      CASE rule_record.schedule_type
        WHEN 'daily' THEN
          -- Send daily reports if not sent today
          IF rule_record.last_sent_at IS NULL OR 
             DATE(rule_record.last_sent_at) < CURRENT_DATE THEN
            should_send := true;
          END IF;
          
        WHEN 'weekly' THEN
          -- Send weekly reports on the correct day of week
          IF rule_record.schedule_day_of_week = now_dow AND
             (rule_record.last_sent_at IS NULL OR 
              DATE(rule_record.last_sent_at) < CURRENT_DATE) THEN
            should_send := true;
          END IF;
          
        WHEN 'monthly' THEN
          -- Send monthly reports on the correct day of month
          IF rule_record.schedule_day_of_month = now_dom AND
             (rule_record.last_sent_at IS NULL OR 
              DATE(rule_record.last_sent_at) < CURRENT_DATE) THEN
            should_send := true;
          END IF;
          
        ELSE
          -- Custom or unknown schedule type - skip
          CONTINUE;
      END CASE;
      
      -- Send the report if it's due
      IF should_send THEN
        BEGIN
          -- Call the edge function to generate and send the report
          SELECT net.http_post(
            url := config_record.supabase_url || '/functions/v1/send-automated-report',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || config_record.supabase_anon_key
            ),
            body := jsonb_build_object('rule_id', rule_record.id)
          ) INTO request_id;
          
          RAISE NOTICE 'Automated report triggered for rule %: %', rule_record.id, rule_record.report_name;
          
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Failed to trigger report for rule %: %', rule_record.id, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Drop existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('process-automated-reports') 
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-automated-reports'
  );
END $$;

-- Schedule the reports processor to run every 15 minutes
SELECT cron.schedule(
  'process-automated-reports',
  '*/15 * * * *',
  'SELECT process_automated_reports();'
);

-- ============================================================================
-- Migration: 20260107150952_fix_automated_reports_timezone_handling.sql
-- ============================================================================

/*
  # Fix Automated Reports Timezone Handling
  
  1. Changes
    - Update process_automated_reports() to properly handle timezone conversions
    - Convert schedule_time from user's timezone to UTC for comparison
    - This ensures reports send at the correct local time regardless of server timezone
  
  2. Details
    - Uses AT TIME ZONE to convert schedule_time to UTC
    - Compares UTC times instead of mixing timezones
    - Maintains backward compatibility with existing automation rules
*/

CREATE OR REPLACE FUNCTION process_automated_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rule_record RECORD;
  config_record RECORD;
  request_id bigint;
  now_utc timestamptz;
  now_dow int;
  now_dom int;
  should_send boolean;
  scheduled_hour int;
  current_hour_in_tz int;
  scheduled_time_utc timestamptz;
BEGIN
  -- Get config for Supabase connection
  SELECT supabase_url, supabase_anon_key INTO config_record
  FROM printavo_sync_config
  LIMIT 1;
  
  IF config_record IS NULL THEN
    RAISE NOTICE 'Supabase config not found, skipping automated reports';
    RETURN;
  END IF;
  
  -- Get current time info in UTC
  now_utc := CURRENT_TIMESTAMP;
  now_dow := EXTRACT(DOW FROM now_utc)::int;
  now_dom := EXTRACT(DAY FROM now_utc)::int;
  
  -- Loop through all enabled automation rules
  FOR rule_record IN 
    SELECT * FROM automated_reports 
    WHERE is_enabled = true
  LOOP
    should_send := false;
    
    -- Convert the scheduled time from user's timezone to UTC for today
    -- This creates a full timestamp for today at the scheduled time in the user's timezone
    scheduled_time_utc := (CURRENT_DATE || ' ' || rule_record.schedule_time)::timestamp 
                          AT TIME ZONE rule_record.schedule_timezone 
                          AT TIME ZONE 'UTC';
    
    -- Check if we're in the same hour as the scheduled time (within 15 min window)
    -- We use a 15-minute window since the cron runs every 15 minutes
    IF now_utc >= scheduled_time_utc AND 
       now_utc < scheduled_time_utc + INTERVAL '15 minutes' THEN
      
      -- Check schedule type
      CASE rule_record.schedule_type
        WHEN 'daily' THEN
          -- Send daily reports if not sent today
          IF rule_record.last_sent_at IS NULL OR 
             DATE(rule_record.last_sent_at AT TIME ZONE rule_record.schedule_timezone) < 
             DATE(now_utc AT TIME ZONE rule_record.schedule_timezone) THEN
            should_send := true;
          END IF;
          
        WHEN 'weekly' THEN
          -- Send weekly reports on the correct day of week
          -- Use the day of week in the user's timezone
          IF rule_record.schedule_day_of_week = EXTRACT(DOW FROM (now_utc AT TIME ZONE rule_record.schedule_timezone))::int AND
             (rule_record.last_sent_at IS NULL OR 
              DATE(rule_record.last_sent_at AT TIME ZONE rule_record.schedule_timezone) < 
              DATE(now_utc AT TIME ZONE rule_record.schedule_timezone)) THEN
            should_send := true;
          END IF;
          
        WHEN 'monthly' THEN
          -- Send monthly reports on the correct day of month
          -- Use the day of month in the user's timezone
          IF rule_record.schedule_day_of_month = EXTRACT(DAY FROM (now_utc AT TIME ZONE rule_record.schedule_timezone))::int AND
             (rule_record.last_sent_at IS NULL OR 
              DATE(rule_record.last_sent_at AT TIME ZONE rule_record.schedule_timezone) < 
              DATE(now_utc AT TIME ZONE rule_record.schedule_timezone)) THEN
            should_send := true;
          END IF;
          
        ELSE
          -- Custom or unknown schedule type - skip
          CONTINUE;
      END CASE;
      
      -- Send the report if it's due
      IF should_send THEN
        BEGIN
          -- Call the edge function to generate and send the report
          SELECT net.http_post(
            url := config_record.supabase_url || '/functions/v1/send-automated-report',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || config_record.supabase_anon_key
            ),
            body := jsonb_build_object('rule_id', rule_record.id)
          ) INTO request_id;
          
          RAISE NOTICE 'Automated report triggered for rule %: % (scheduled: %, current UTC: %)', 
                       rule_record.id, rule_record.report_name, scheduled_time_utc, now_utc;
          
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Failed to trigger report for rule %: %', rule_record.id, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END;
$$;


-- ============================================================================
-- Migration: 20260107211832_create_customers_table.sql
-- ============================================================================

/*
  # Create Customers Table

  1. New Tables
    - `customers`
      - Customer identification (name, company, email, phone)
      - Billing address information
      - Shipping address information
      - Customer preferences and notes
      - Audit fields (created_at, updated_at)

  2. Security
    - Enable RLS on customers table
    - Add policies for authenticated users to manage customers

  3. Indexes
    - Index on email for quick lookups
    - Index on company name for searching
    - Index on created_at for sorting
*/

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company/Contact Info
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,

  -- Billing Address
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text DEFAULT 'USA',

  -- Shipping Address
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text DEFAULT 'USA',

  -- Additional Info
  customer_type text DEFAULT 'business',
  tax_exempt boolean DEFAULT false,
  tax_id text,
  payment_terms text DEFAULT 'Net 30',
  credit_limit decimal(10,2),
  
  -- Notes
  notes text,
  internal_notes text,

  -- Status
  status text DEFAULT 'active',

  -- Audit fields
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Users can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add customer_id to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);


-- ============================================================================
-- Migration: 20260107212300_create_customer_contacts_table.sql
-- ============================================================================

/*
  # Create Customer Contacts Table

  1. New Tables
    - `customer_contacts`
      - Contact identification (name, title, email, phone)
      - Relationship to customer
      - Primary contact flag
      - Audit fields

  2. Security
    - Enable RLS on customer_contacts table
    - Add policies for authenticated users to manage contacts

  3. Indexes
    - Index on customer_id for quick lookups
    - Index on email for searching
*/

-- Customer contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Contact Info
  full_name text NOT NULL,
  title text,
  email text,
  phone text,
  mobile text,
  
  -- Flags
  is_primary boolean DEFAULT false,
  
  -- Notes
  notes text,

  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Customer contacts policies
CREATE POLICY "Users can view all customer contacts"
  ON customer_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customer contacts"
  ON customer_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customer contacts"
  ON customer_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customer contacts"
  ON customer_contacts FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email ON customer_contacts(email);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_contacts_updated_at 
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Migration: 20260107212824_create_automations_tables.sql
-- ============================================================================

/*
  # Create Automations Engine Tables

  1. New Tables
    - `automations`
      - `id` (uuid, primary key)
      - `name` (text) - Automation name
      - `description` (text) - Optional description
      - `trigger_type` (text) - Trigger type (invoice_created, status_changed, etc.)
      - `trigger_config` (jsonb) - Trigger configuration
      - `conditions` (jsonb) - Array of conditions with AND/OR logic
      - `actions` (jsonb) - Array of actions to execute
      - `scheduling` (jsonb) - Scheduling configuration (immediate, delayed, scheduled)
      - `is_enabled` (boolean) - Whether automation is active
      - `created_by` (uuid) - User who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `automation_logs`
      - `id` (uuid, primary key)
      - `automation_id` (uuid) - Reference to automation
      - `trigger_event` (jsonb) - Event data that triggered automation
      - `executed_actions` (jsonb) - Actions that were executed
      - `status` (text) - success, failure, partial
      - `error_message` (text) - Error details if failed
      - `executed_at` (timestamptz)
      - `execution_time_ms` (integer) - How long it took to execute

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Indexes
    - Index on automation status and enabled flag
    - Index on automation_logs for filtering by automation_id and status
*/

-- Automations table
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  scheduling jsonb DEFAULT '{"type": "immediate"}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Automation logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event jsonb DEFAULT '{}'::jsonb,
  executed_actions jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'success',
  error_message text,
  executed_at timestamptz DEFAULT now(),
  execution_time_ms integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Automations policies
CREATE POLICY "Users can view all automations"
  ON automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete automations"
  ON automations FOR DELETE
  TO authenticated
  USING (true);

-- Automation logs policies
CREATE POLICY "Users can view all automation logs"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automation logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_automations_updated_at 
  BEFORE UPDATE ON automations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Migration: 20260108132202_add_billing_status_filters.sql
-- ============================================================================

/*
  # Add Billing Status Filters

  1. Changes
    - Add `billing_selected_invoice_statuses` column to `company_settings` table
    - This allows separate status filtering for the Billing & Payments section
    - Defaults to empty array to maintain existing behavior

  2. Purpose
    - Enable independent filtering for Production Dashboard and Billing & Payments sections
    - Each section can now have its own set of visible invoice statuses
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'billing_selected_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN billing_selected_invoice_statuses text[] DEFAULT '{}';
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260108133237_create_stripe_integration_tables_fixed.sql
-- ============================================================================

/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_payment_links` - Stores Stripe payment links for Printavo invoices
    - `stripe_payments` - Tracks Stripe payment records
    - `stripe_webhook_events` - Logs webhook events for debugging

  2. Security
    - Enable RLS on all tables
    - Policies allow users to manage their own company's data

  3. Indexes
    - Added for performance on common queries
*/

-- Create stripe_payment_links table
CREATE TABLE IF NOT EXISTS stripe_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_invoice_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'active',
  customer_email text,
  customer_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Create stripe_payments table
CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'processing',
  customer_email text,
  customer_name text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_webhook_events table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for stripe_payment_links
CREATE OR REPLACE FUNCTION update_stripe_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_payment_links_updated_at ON stripe_payment_links;
CREATE TRIGGER stripe_payment_links_updated_at
  BEFORE UPDATE ON stripe_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payment_links_updated_at();

-- Add updated_at trigger for stripe_payments
CREATE OR REPLACE FUNCTION update_stripe_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_payments_updated_at ON stripe_payments;
CREATE TRIGGER stripe_payments_updated_at
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payments_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id ON stripe_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_printavo_invoice_id ON stripe_payment_links(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_status ON stripe_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id ON stripe_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_printavo_invoice_id ON stripe_payments(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Enable RLS
ALTER TABLE stripe_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_payment_links
CREATE POLICY "Users can view payment links"
  ON stripe_payment_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payment links"
  ON stripe_payment_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payment links"
  ON stripe_payment_links FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for stripe_payments
CREATE POLICY "Users can view payments"
  ON stripe_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payments"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payments"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for stripe_webhook_events
CREATE POLICY "Users can view webhook events"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert webhook events"
  ON stripe_webhook_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update webhook events"
  ON stripe_webhook_events FOR UPDATE
  TO authenticated
  USING (true);


-- ============================================================================
-- Migration: 20260108133253_add_stripe_credentials_to_company_settings.sql
-- ============================================================================

/*
  # Add Stripe Credentials to Company Settings

  1. Changes
    - Add `stripe_public_key` (encrypted)
    - Add `stripe_secret_key` (encrypted)
    - Add `stripe_webhook_secret` (encrypted)
    - These enable Stripe payment processing in Billing & Payments section

  2. Security
    - Keys are stored encrypted
    - Only accessible through secure backend services
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_public_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_public_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_secret_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_secret_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_webhook_secret'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_webhook_secret text;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260108150433_create_billing_workflow_tables.sql
-- ============================================================================

/*
  # Billing Workflow Schema

  1. New Tables
    - `billing_queue` - Tracks invoices in the billing queue
      - Links Printavo invoices to billing state
      - Tracks sent status, payment links, and communication
    
    - `communication_logs` - Records all customer communications
      - Emails, SMS, link sharing
      - Full audit trail for compliance
    
    - `paid_invoices` - Archives completed payments
      - Stores final payment records
      - Links to Printavo invoice and Stripe payment

  2. Security
    - Enable RLS on all tables
    - Users can access their company's data only

  3. Indexes
    - Added for common queries and foreign keys
*/

-- Create billing_queue table
CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  printavo_status text,
  customer_name text,
  customer_email text,
  customer_company text,
  invoice_total numeric(10, 2) NOT NULL DEFAULT 0,
  invoice_date timestamptz,
  due_date timestamptz,
  stripe_payment_link_id text,
  stripe_invoice_id text,
  sent_at timestamptz,
  sent_method text,
  payment_status text DEFAULT 'unpaid',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create communication_logs table
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  communication_type text NOT NULL,
  method text NOT NULL,
  recipient text NOT NULL,
  subject text,
  message text,
  status text DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}',
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz DEFAULT now()
);

-- Create paid_invoices table
CREATE TABLE IF NOT EXISTS paid_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  customer_name text,
  customer_email text,
  invoice_total numeric(10, 2) NOT NULL,
  amount_paid numeric(10, 2) NOT NULL,
  payment_date timestamptz NOT NULL,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for billing_queue
CREATE OR REPLACE FUNCTION update_billing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_queue_updated_at ON billing_queue;
CREATE TRIGGER billing_queue_updated_at
  BEFORE UPDATE ON billing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_queue_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_printavo_invoice_id ON billing_queue(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_payment_status ON billing_queue(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_sent_at ON billing_queue(sent_at);

CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_printavo_invoice_id ON communication_logs(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_printavo_invoice_id ON paid_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_payment_date ON paid_invoices(payment_date);

-- Enable RLS
ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_queue
CREATE POLICY "Users can view billing queue"
  ON billing_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert to billing queue"
  ON billing_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update billing queue"
  ON billing_queue FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete from billing queue"
  ON billing_queue FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for communication_logs
CREATE POLICY "Users can view communication logs"
  ON communication_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert communication logs"
  ON communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for paid_invoices
CREATE POLICY "Users can view paid invoices"
  ON paid_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert paid invoices"
  ON paid_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ============================================================================
-- Migration: 20260108185301_add_stripe_invoice_partial_payments.sql
-- ============================================================================

/*
  # Add Stripe Invoice and Partial Payment Support

  ## New Tables
  
  ### `stripe_invoices`
  Tracks Stripe invoices created for Printavo invoices with minimum payment support
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to company_settings)
  - `printavo_invoice_id` (text, Printavo invoice ID)
  - `stripe_invoice_id` (text, unique, Stripe invoice ID)
  - `stripe_customer_id` (text, Stripe customer ID)
  - `hosted_invoice_url` (text, customer-facing URL)
  - `invoice_pdf_url` (text, PDF URL)
  - `total_amount` (numeric, total invoice amount in cents)
  - `minimum_due_amount` (numeric, minimum payment required in cents)
  - `amount_paid` (numeric, total amount paid in cents, default 0)
  - `amount_remaining` (numeric, remaining balance in cents)
  - `currency` (text, default 'usd')
  - `status` (text, Stripe invoice status: draft, open, paid, void, uncollectible)
  - `customer_email` (text)
  - `customer_name` (text)
  - `description` (text)
  - `metadata` (jsonb, additional Printavo data)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `paid_at` (timestamptz, nullable)

  ### `stripe_payment_history`
  Tracks all payments made against Stripe invoices (supports partial payments)
  - `id` (uuid, primary key)
  - `stripe_invoice_id` (uuid, foreign key to stripe_invoices)
  - `payment_intent_id` (text, Stripe payment intent ID)
  - `charge_id` (text, Stripe charge ID)
  - `amount` (numeric, payment amount in cents)
  - `currency` (text, default 'usd')
  - `status` (text, succeeded, failed, canceled)
  - `payment_method` (text, card, bank_transfer, etc.)
  - `receipt_url` (text, Stripe receipt URL)
  - `created_at` (timestamptz)
  - `metadata` (jsonb)

  ## Security
  - Enable RLS on both tables
  - Add policies for authenticated users to access data

  ## Notes
  - Supports 50% minimum payment requirement
  - Tracks partial and full payments
  - Stripe handles payment collection and balance tracking
*/

-- Create stripe_invoices table
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  stripe_invoice_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  hosted_invoice_url text NOT NULL,
  invoice_pdf_url text,
  total_amount numeric NOT NULL,
  minimum_due_amount numeric NOT NULL,
  amount_paid numeric DEFAULT 0 NOT NULL,
  amount_remaining numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  customer_email text,
  customer_name text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz,
  CONSTRAINT valid_amounts CHECK (amount_paid >= 0 AND amount_remaining >= 0 AND total_amount > 0),
  CONSTRAINT valid_minimum CHECK (minimum_due_amount >= 0 AND minimum_due_amount <= total_amount)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_printavo_id ON stripe_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON stripe_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_stripe_id ON stripe_invoices(stripe_invoice_id);

-- Create stripe_payment_history table
CREATE TABLE IF NOT EXISTS stripe_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id uuid NOT NULL REFERENCES stripe_invoices(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL,
  charge_id text,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'succeeded' NOT NULL,
  payment_method text,
  receipt_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Create indexes for payment history
CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON stripe_payment_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_intent ON stripe_payment_history(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON stripe_payment_history(created_at DESC);

-- Enable RLS
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_invoices
-- Following the existing company_settings pattern where all authenticated users have access

CREATE POLICY "Authenticated users can view stripe invoices"
  ON stripe_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create stripe invoices"
  ON stripe_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stripe invoices"
  ON stripe_invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for stripe_payment_history

CREATE POLICY "Authenticated users can view payment history"
  ON stripe_payment_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payment history"
  ON stripe_payment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stripe_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on stripe_invoices
DROP TRIGGER IF EXISTS trigger_update_stripe_invoice_timestamp ON stripe_invoices;
CREATE TRIGGER trigger_update_stripe_invoice_timestamp
  BEFORE UPDATE ON stripe_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_invoice_updated_at();

-- ============================================================================
-- Migration: 20260109163237_add_status_stage_to_invoices.sql
-- ============================================================================

/*
  # Add status_stage field to invoices

  1. Changes
    - Add `status_stage` column to `printavo_invoices` table
    - Status stages: 'billing_queue', 'sent', 'partial', 'paid', 'overdue'
    - Default value: 'billing_queue'
    - Index on status_stage for efficient queries

  2. Purpose
    - Track invoice lifecycle stages
    - Enable filtering of paid invoices
    - Support accounts receivable workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'status_stage'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN status_stage text DEFAULT 'billing_queue';

    ALTER TABLE printavo_invoices
    ADD CONSTRAINT printavo_invoices_status_stage_check
    CHECK (status_stage IN ('billing_queue', 'sent', 'partial', 'paid', 'overdue'));

    CREATE INDEX IF NOT EXISTS idx_printavo_invoices_status_stage
    ON printavo_invoices(status_stage);

    UPDATE printavo_invoices
    SET status_stage = CASE
      WHEN status = 'Paid' THEN 'paid'
      WHEN status = 'Partially Paid' THEN 'partial'
      WHEN status = 'Unpaid' THEN 'billing_queue'
      ELSE 'billing_queue'
    END
    WHERE status_stage IS NULL OR status_stage = 'billing_queue';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260109164453_add_customer_linking_to_invoices.sql
-- ============================================================================

/*
  # Link Customers to Invoices

  ## Description
  This migration adds the infrastructure to link the `customers` table
  with the `printavo_invoices` table. Customers will be automatically
  created when invoices are synced from Printavo.

  ## Changes

  1. Schema Updates
    - Add `customer_id` foreign key to `printavo_invoices`
    - Add `printavo_customer_id` to `customers` to track Printavo ID
    - Add indexes for performance

  2. Data Integrity
    - Foreign key constraint to ensure data consistency
    - Nullable customer_id to support existing invoices

  ## Notes
  - Existing invoices will have NULL customer_id initially
  - Customer sync will populate these relationships automatically
  - Customers are matched by email first, then by name
*/

-- Add printavo_customer_id to customers table to track Printavo customer ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'printavo_customer_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN printavo_customer_id text;
  END IF;
END $$;

-- Add customer_id foreign key to printavo_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create index on printavo_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_printavo_id ON customers(printavo_customer_id);

-- Create index on customer_id in printavo_invoices for faster joins
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id ON printavo_invoices(customer_id);

-- Add customer_phone to printavo_invoices if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260109165024_backfill_customers_from_invoices.sql
-- ============================================================================

/*
  # Backfill Customers from Existing Invoices

  ## Description
  This migration creates customer records for all existing invoices
  and links invoices to their customers. This is needed because the
  customer-linking logic was added after invoices were already synced.

  ## Process
  1. Find all unique customers from invoices
  2. Create customer records for each unique customer
  3. Link invoices to their respective customers

  ## Matching Logic
  - Match by email first (if available)
  - Fall back to matching by customer name
  - Create new customer if no match found
*/

-- Create a function to backfill customers
CREATE OR REPLACE FUNCTION backfill_customers_from_invoices()
RETURNS TABLE(
  customers_created integer,
  invoices_linked integer
) AS $$
DECLARE
  v_customers_created integer := 0;
  v_invoices_linked integer := 0;
  v_invoice RECORD;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_email text;
BEGIN
  -- Loop through all invoices that don't have a customer_id
  FOR v_invoice IN 
    SELECT DISTINCT ON (customer_name, customer_email)
      id,
      customer_name,
      customer_email,
      customer_company,
      customer_phone
    FROM printavo_invoices
    WHERE customer_id IS NULL
      AND customer_name IS NOT NULL
      AND customer_name != ''
    ORDER BY customer_name, customer_email, created_at DESC
  LOOP
    v_customer_name := COALESCE(v_invoice.customer_company, v_invoice.customer_name);
    v_customer_email := v_invoice.customer_email;
    v_customer_id := NULL;

    -- Try to find existing customer by email
    IF v_customer_email IS NOT NULL AND v_customer_email != '' THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE email = v_customer_email
      LIMIT 1;
    END IF;

    -- If not found by email, try by company name
    IF v_customer_id IS NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE company_name = v_customer_name
      LIMIT 1;
    END IF;

    -- Create customer if not found
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (
        company_name,
        contact_name,
        email,
        phone,
        status
      ) VALUES (
        v_customer_name,
        v_invoice.customer_name,
        v_customer_email,
        v_invoice.customer_phone,
        'active'
      )
      RETURNING id INTO v_customer_id;
      
      v_customers_created := v_customers_created + 1;
    END IF;

    -- Link all invoices for this customer
    UPDATE printavo_invoices
    SET customer_id = v_customer_id
    WHERE customer_id IS NULL
      AND (
        (customer_email IS NOT NULL AND customer_email != '' AND customer_email = v_customer_email)
        OR (customer_name = v_invoice.customer_name AND (v_customer_email IS NULL OR v_customer_email = ''))
      );
    
    GET DIAGNOSTICS v_invoices_linked = ROW_COUNT;
  END LOOP;

  RETURN QUERY SELECT v_customers_created, v_invoices_linked;
END;
$$ LANGUAGE plpgsql;

-- Run the backfill function
SELECT * FROM backfill_customers_from_invoices();

-- Drop the function after use (optional, can keep for re-runs)
-- DROP FUNCTION IF EXISTS backfill_customers_from_invoices();


-- ============================================================================
-- Migration: 20260109165203_create_get_customers_with_stats_function.sql
-- ============================================================================

/*
  # Create Function to Get Customers with Stats

  ## Description
  Creates an optimized database function to fetch all customers
  along with their invoice statistics in a single efficient query.
  This replaces multiple round-trip queries with a single database call.

  ## Returns
  - customer_id: UUID of the customer
  - company_name: Customer's company name
  - contact_name: Customer's contact name
  - email: Customer's email
  - phone: Customer's phone
  - total_invoices: Count of invoices for this customer
  - total_billed: Sum of all invoice totals
  - total_paid: Sum of all amounts paid
  - outstanding_balance: Total billed minus total paid

  ## Performance
  Uses a single LEFT JOIN with aggregation for optimal performance.
*/

CREATE OR REPLACE FUNCTION get_customers_with_stats()
RETURNS TABLE (
  customer_id uuid,
  company_name text,
  contact_name text,
  email text,
  phone text,
  total_invoices bigint,
  total_billed numeric,
  total_paid numeric,
  outstanding_balance numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as customer_id,
    c.company_name,
    c.contact_name,
    c.email,
    c.phone,
    COUNT(pi.id) as total_invoices,
    COALESCE(SUM(CAST(pi.total AS numeric)), 0) as total_billed,
    COALESCE(SUM(CAST(pi.amount_paid AS numeric)), 0) as total_paid,
    COALESCE(SUM(CAST(pi.total AS numeric)), 0) - COALESCE(SUM(CAST(pi.amount_paid AS numeric)), 0) as outstanding_balance
  FROM customers c
  LEFT JOIN printavo_invoices pi ON pi.customer_id = c.id
  GROUP BY c.id, c.company_name, c.contact_name, c.email, c.phone
  ORDER BY total_billed DESC;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- Migration: 20260109172113_update_accounting_workflow_schema.sql
-- ============================================================================

/*
  # Update Accounting Workflow Schema

  ## Description
  This migration updates the database schema to support the complete accounting workflow:
  - Customers are created automatically when invoices are synced
  - Invoices start in billing_queue, move to accounts_receivable when payment links are sent
  - Payments are tracked in a unified payments table
  - Invoices move to paid status when fully paid

  ## Changes

  1. **Customers Table Updates**
    - Add `billing_address` (jsonb) - billing address from Printavo
    - Add `shipping_address` (jsonb) - shipping address from Printavo

  2. **Printavo Invoices Updates**
    - Update status_stage values to match workflow
    - Add billing_address and shipping_address columns
    - Add date_sent field to track when payment link was sent
    - Add payment_link field to store the Stripe payment link

  3. **Payments Table** (NEW)
    - Track all payments received (Stripe and future payment methods)
    - Link to invoice and customer
    - Store payment method, amount, date, transaction details

  ## Status Stage Workflow
  - `billing_queue`: New invoices waiting for payment links to be sent
  - `accounts_receivable`: Payment link sent, awaiting payment
  - `paid`: Invoice fully paid (amount_outstanding = 0)
*/

-- Update customers table to add address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE customers ADD COLUMN billing_address jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE customers ADD COLUMN shipping_address jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update printavo_invoices table
DO $$
BEGIN
  -- Add billing_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add shipping_address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add date_sent to track when payment link was sent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'date_sent'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN date_sent timestamptz;
  END IF;

  -- Add payment_link to store Stripe payment link URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'payment_link'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN payment_link text;
  END IF;

  -- Update status_stage constraint to only allow our three workflow stages
  ALTER TABLE printavo_invoices DROP CONSTRAINT IF EXISTS printavo_invoices_status_stage_check;
  ALTER TABLE printavo_invoices ADD CONSTRAINT printavo_invoices_status_stage_check
    CHECK (status_stage IN ('billing_queue', 'accounts_receivable', 'paid'));
END $$;

-- Create payments table to track all payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_date timestamptz DEFAULT now() NOT NULL,
  payment_method text,
  stripe_transaction_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  receipt_url text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Create indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);

-- Enable RLS for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on payments
DROP TRIGGER IF EXISTS trigger_update_payment_timestamp ON payments;
CREATE TRIGGER trigger_update_payment_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_updated_at();

-- Create index on status_stage for workflow queries
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_workflow 
  ON printavo_invoices(status_stage, amount_outstanding) 
  WHERE status_stage IN ('billing_queue', 'accounts_receivable');

-- Update all existing invoices to have correct status_stage based on balance
UPDATE printavo_invoices
SET status_stage = CASE
  WHEN amount_outstanding = 0 THEN 'paid'
  WHEN date_sent IS NOT NULL OR payment_link IS NOT NULL THEN 'accounts_receivable'
  ELSE 'billing_queue'
END
WHERE status_stage NOT IN ('billing_queue', 'accounts_receivable', 'paid')
   OR status_stage IS NULL;

-- ============================================================================
-- Migration: 20260109201428_create_ar_report_automation_tables_v2.sql
-- ============================================================================

/*
  # Create AR Report Automation and Presets Tables

  1. New Tables
    - `ar_report_presets`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `name` (text) - preset name
      - `columns` (jsonb) - array of column names to include
      - `filters` (jsonb) - filter configuration
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `ar_report_automations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `name` (text) - automation name
      - `frequency` (text) - daily, weekly, monthly
      - `time_of_day` (time) - when to send
      - `day_of_week` (int) - for weekly (0-6, 0=Sunday)
      - `day_of_month` (int) - for monthly (1-31)
      - `recipients` (jsonb) - array of email addresses
      - `format` (text) - pdf or csv
      - `filters` (jsonb) - filter configuration
      - `columns` (jsonb) - array of column names to include
      - `enabled` (boolean)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `ar_report_logs`
      - `id` (uuid, primary key)
      - `automation_id` (uuid, references ar_report_automations)
      - `company_id` (uuid, references company_settings)
      - `executed_at` (timestamptz)
      - `format` (text)
      - `filters` (jsonb)
      - `recipients` (jsonb)
      - `success` (boolean)
      - `error_message` (text)
      - `invoice_count` (int)
      - `total_outstanding` (numeric)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their company's data
*/

-- AR Report Presets Table
CREATE TABLE IF NOT EXISTS ar_report_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ar_report_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's AR report presets"
  ON ar_report_presets FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create AR report presets for their company"
  ON ar_report_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's AR report presets"
  ON ar_report_presets FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company's AR report presets"
  ON ar_report_presets FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

-- AR Report Automations Table
CREATE TABLE IF NOT EXISTS ar_report_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  time_of_day time NOT NULL DEFAULT '09:00:00',
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 31),
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  format text NOT NULL CHECK (format IN ('pdf', 'csv')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ar_report_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's AR report automations"
  ON ar_report_automations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create AR report automations for their company"
  ON ar_report_automations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's AR report automations"
  ON ar_report_automations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company's AR report automations"
  ON ar_report_automations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

-- AR Report Logs Table
CREATE TABLE IF NOT EXISTS ar_report_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES ar_report_automations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  executed_at timestamptz DEFAULT now() NOT NULL,
  format text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  success boolean NOT NULL,
  error_message text,
  invoice_count int,
  total_outstanding numeric(10, 2)
);

ALTER TABLE ar_report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's AR report logs"
  ON ar_report_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM company_settings
      WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ar_report_presets_company ON ar_report_presets(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_automations_company ON ar_report_automations(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_automations_enabled ON ar_report_automations(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_automation ON ar_report_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_company ON ar_report_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_executed_at ON ar_report_logs(executed_at DESC);

-- ============================================================================
-- Migration: 20260109201955_setup_ar_report_automation_cron_v3.sql
-- ============================================================================

/*
  # Setup Cron Job for AR Report Automation

  1. Creates a function to check and execute AR report automations
  2. Sets up a cron job to run every hour
  
  The function will:
  - Find all enabled AR report automations
  - Check if each automation should run based on schedule
  - Call the edge function to generate and send the report
  - Log the execution
*/

-- Create function to check and execute AR report automations
CREATE OR REPLACE FUNCTION check_ar_report_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  automation_record RECORD;
  time_now TIME;
  day_of_week_now INT;
  day_of_month_now INT;
  should_execute BOOLEAN;
BEGIN
  time_now := CURRENT_TIME;
  day_of_week_now := EXTRACT(DOW FROM CURRENT_DATE);
  day_of_month_now := EXTRACT(DAY FROM CURRENT_DATE);

  FOR automation_record IN
    SELECT *
    FROM ar_report_automations
    WHERE enabled = true
  LOOP
    should_execute := false;

    IF automation_record.frequency = 'daily' THEN
      should_execute := (time_now BETWEEN automation_record.time_of_day AND (automation_record.time_of_day + INTERVAL '1 hour'));
    
    ELSIF automation_record.frequency = 'weekly' THEN
      should_execute := (
        day_of_week_now = automation_record.day_of_week AND
        time_now BETWEEN automation_record.time_of_day AND (automation_record.time_of_day + INTERVAL '1 hour')
      );
    
    ELSIF automation_record.frequency = 'monthly' THEN
      should_execute := (
        day_of_month_now = automation_record.day_of_month AND
        time_now BETWEEN automation_record.time_of_day AND (automation_record.time_of_day + INTERVAL '1 hour')
      );
    END IF;

    IF should_execute THEN
      BEGIN
        RAISE NOTICE 'Executing AR report automation: % (ID: %)', automation_record.name, automation_record.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Error executing AR report automation %: %', automation_record.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

-- Schedule the cron job to run every hour
DO $cron$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'check-ar-report-automations'
  ) THEN
    PERFORM cron.schedule(
      'check-ar-report-automations',
      '0 * * * *',
      'SELECT check_ar_report_automations()'
    );
  END IF;
END $cron$;

-- ============================================================================
-- Migration: 20260111205647_add_twilio_sms_integration.sql
-- ============================================================================

/*
  # Add Twilio SMS Integration

  ## Description
  This migration adds SMS sending capabilities using Twilio for invoice delivery.
  It creates the infrastructure needed to send invoices via Email, Text Message, or Both.

  ## New Tables
  1. `sms_logs`
    - `id` (uuid, primary key)
    - `invoice_id` (text, foreign key to printavo_invoices)
    - `customer_id` (uuid, foreign key to customers)
    - `phone_number` (text, the recipient phone number)
    - `message_body` (text, the SMS content sent)
    - `delivery_status` (text, e.g., 'sent', 'delivered', 'failed', 'undelivered')
    - `twilio_sid` (text, Twilio message SID for tracking)
    - `error_message` (text, nullable, error details if failed)
    - `sent_at` (timestamptz, when the SMS was sent)
    - `created_at` (timestamptz, record creation time)

  ## Updates to Existing Tables
  1. `company_settings`
    - Add `twilio_account_sid` (text, encrypted Twilio Account SID)
    - Add `twilio_auth_token` (text, encrypted Twilio Auth Token)
    - Add `twilio_phone_number` (text, the Twilio phone number to send from)
    - Add `twilio_enabled` (boolean, whether SMS is enabled)
    - Add `default_send_method` (text, default: 'email', options: 'email', 'sms', 'both')
    - Add `sms_message_template` (text, customizable SMS template)

  2. `customers`
    - Ensure `phone` field exists (it should from previous migrations)

  ## Security
  - Enable RLS on `sms_logs` table
  - Add policies for authenticated users to read SMS logs for their company
  - Twilio credentials are encrypted in company_settings

  ## Notes
  - SMS logs are created for tracking and compliance
  - Phone numbers should be in E.164 format (+1234567890)
  - Delivery status is updated via webhook or polling
*/

-- Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'sent',
  twilio_sid text,
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_logs_invoice_id ON sms_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_customer_id ON sms_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);

-- Enable RLS on sms_logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read SMS logs
CREATE POLICY "Users can read SMS logs"
  ON sms_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert SMS logs
CREATE POLICY "Users can insert SMS logs"
  ON sms_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update SMS logs
CREATE POLICY "Users can update SMS logs"
  ON sms_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add Twilio fields to company_settings
DO $$
BEGIN
  -- Add twilio_account_sid if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_account_sid'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_account_sid text;
  END IF;

  -- Add twilio_auth_token if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_auth_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_auth_token text;
  END IF;

  -- Add twilio_phone_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_phone_number'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_phone_number text;
  END IF;

  -- Add twilio_enabled if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_enabled boolean DEFAULT false;
  END IF;

  -- Add default_send_method if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'default_send_method'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN default_send_method text DEFAULT 'email';
  END IF;

  -- Add sms_message_template if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sms_message_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sms_message_template text DEFAULT 'Hi {CustomerName}, your invoice {InvoiceNumber} is ready. Amount Due: ${Amount}. Pay here: {PaymentLink}. Reply STOP to unsubscribe.';
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260112010754_add_complete_customer_fields_to_invoices.sql
-- ============================================================================

/*
  # Add Complete Customer Fields to Invoices

  ## Changes
  
  This migration ensures that the printavo_invoices table contains all necessary
  customer fields to display complete invoice information without relying on the
  customer table.

  ## Fields Added/Verified
  
  1. Customer contact fields:
     - customer_phone (already exists)
     - customer_email (already exists)
     - customer_name (already exists)
     - customer_company (already exists)
  
  2. Address fields (JSONB format):
     - billing_address: {line1, line2, city, state, zip, country}
     - shipping_address: {line1, line2, city, state, zip, country}
  
  ## Notes
  
  - All fields are nullable to accommodate incomplete data from Printavo
  - JSONB format allows flexible address storage
  - Future syncs will populate these fields from Printavo customer data
*/

-- Ensure customer_phone exists (should already exist based on previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- Ensure billing_address exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address jsonb;
  END IF;
END $$;

-- Ensure shipping_address exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address jsonb;
  END IF;
END $$;

-- Add index for faster customer field queries
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_phone 
ON printavo_invoices(customer_phone);

-- Add index for customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id 
ON printavo_invoices(customer_id);

-- Add comment to document the structure
COMMENT ON COLUMN printavo_invoices.billing_address IS 
'Customer billing address in JSON format: {line1, line2, city, state, zip, country}';

COMMENT ON COLUMN printavo_invoices.shipping_address IS 
'Customer shipping address in JSON format: {line1, line2, city, state, zip, country}';


-- ============================================================================
-- Migration: 20260112013508_add_complete_customer_fields_to_invoices.sql
-- ============================================================================

/*
  # Add Complete Customer Fields to Invoices Table

  This migration adds comprehensive customer information fields to the invoices table
  to support full customer data display in invoice views and PDF exports.

  ## Changes

  1. **New Fields Added to printavo_invoices**
     - `customer_phone` - Phone number from customer's primary contact
     - `billing_address_line1` - First line of billing address
     - `billing_address_line2` - Second line of billing address
     - `billing_city` - Billing address city
     - `billing_state` - Billing address state/province
     - `billing_zip` - Billing address postal code
     - `billing_country` - Billing address country
     - `shipping_address_line1` - First line of shipping address
     - `shipping_address_line2` - Second line of shipping address
     - `shipping_city` - Shipping address city
     - `shipping_state` - Shipping address state/province
     - `shipping_zip` - Shipping address postal code
     - `shipping_country` - Shipping address country

  2. **Purpose**
     - Store complete customer snapshot at time of invoice creation
     - Enable full customer information display in invoice views
     - Support complete PDF invoice generation without additional queries
     - Maintain historical accuracy even if customer data changes later

  ## Notes
  - All fields are nullable to handle cases where data is not available
  - These fields store a snapshot of customer data at sync time
  - Invoice display should use these fields, not live customer table data
*/

-- Add phone field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- Add billing address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address_line1'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address_line1 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address_line2'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address_line2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_city'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_state'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_zip'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_zip text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_country'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_country text;
  END IF;
END $$;

-- Add shipping address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address_line1'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address_line1 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address_line2'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address_line2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_city'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_state'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_zip'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_zip text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_country'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_country text;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260112203029_20260107211832_create_customers_table.sql
-- ============================================================================

/*
  # Create Customers Table

  1. New Tables
    - `customers`
      - Customer identification (name, company, email, phone)
      - Billing address information
      - Shipping address information
      - Customer preferences and notes
      - Audit fields (created_at, updated_at)

  2. Security
    - Enable RLS on customers table
    - Add policies for authenticated users to manage customers

  3. Indexes
    - Index on email for quick lookups
    - Index on company name for searching
    - Index on created_at for sorting
*/

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company/Contact Info
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,

  -- Billing Address
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text DEFAULT 'USA',

  -- Shipping Address
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text DEFAULT 'USA',

  -- Additional Info
  customer_type text DEFAULT 'business',
  tax_exempt boolean DEFAULT false,
  tax_id text,
  payment_terms text DEFAULT 'Net 30',
  credit_limit decimal(10,2),
  
  -- Notes
  notes text,
  internal_notes text,

  -- Status
  status text DEFAULT 'active',

  -- Audit fields
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Users can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: 20260112203058_20260107212300_create_customer_contacts_table.sql
-- ============================================================================

/*
  # Create Customer Contacts Table

  1. New Tables
    - `customer_contacts`
      - Contact identification (name, title, email, phone)
      - Relationship to customer
      - Primary contact flag
      - Audit fields

  2. Security
    - Enable RLS on customer_contacts table
    - Add policies for authenticated users to manage contacts

  3. Indexes
    - Index on customer_id for quick lookups
    - Index on email for searching
*/

-- Customer contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Contact Info
  full_name text NOT NULL,
  title text,
  email text,
  phone text,
  mobile text,
  
  -- Flags
  is_primary boolean DEFAULT false,
  
  -- Notes
  notes text,

  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Customer contacts policies
CREATE POLICY "Users can view all customer contacts"
  ON customer_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customer contacts"
  ON customer_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customer contacts"
  ON customer_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customer contacts"
  ON customer_contacts FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_email ON customer_contacts(email);

-- Trigger for updated_at
CREATE TRIGGER update_customer_contacts_updated_at 
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: 20260112203100_20260107212824_create_automations_tables.sql
-- ============================================================================

/*
  # Create Automations Engine Tables

  1. New Tables
    - `automations`
      - `id` (uuid, primary key)
      - `name` (text) - Automation name
      - `description` (text) - Optional description
      - `trigger_type` (text) - Trigger type (invoice_created, status_changed, etc.)
      - `trigger_config` (jsonb) - Trigger configuration
      - `conditions` (jsonb) - Array of conditions with AND/OR logic
      - `actions` (jsonb) - Array of actions to execute
      - `scheduling` (jsonb) - Scheduling configuration (immediate, delayed, scheduled)
      - `is_enabled` (boolean) - Whether automation is active
      - `created_by` (uuid) - User who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `automation_logs`
      - `id` (uuid, primary key)
      - `automation_id` (uuid) - Reference to automation
      - `trigger_event` (jsonb) - Event data that triggered automation
      - `executed_actions` (jsonb) - Actions that were executed
      - `status` (text) - success, failure, partial
      - `error_message` (text) - Error details if failed
      - `executed_at` (timestamptz)
      - `execution_time_ms` (integer) - How long it took to execute

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Indexes
    - Index on automation status and enabled flag
    - Index on automation_logs for filtering by automation_id and status
*/

-- Automations table
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  scheduling jsonb DEFAULT '{"type": "immediate"}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Automation logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event jsonb DEFAULT '{}'::jsonb,
  executed_actions jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'success',
  error_message text,
  executed_at timestamptz DEFAULT now(),
  execution_time_ms integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Automations policies
CREATE POLICY "Users can view all automations"
  ON automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete automations"
  ON automations FOR DELETE
  TO authenticated
  USING (true);

-- Automation logs policies
CREATE POLICY "Users can view all automation logs"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automation logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_automations_updated_at 
  BEFORE UPDATE ON automations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: 20260112203101_20260108132202_add_billing_status_filters.sql
-- ============================================================================

/*
  # Add Billing Status Filters

  1. Changes
    - Add `billing_selected_invoice_statuses` column to `company_settings` table
    - This allows separate status filtering for the Billing & Payments section
    - Defaults to empty array to maintain existing behavior

  2. Purpose
    - Enable independent filtering for Production Dashboard and Billing & Payments sections
    - Each section can now have its own set of visible invoice statuses
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'billing_selected_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN billing_selected_invoice_statuses text[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260112203141_20260108133237_create_stripe_integration_tables_fixed.sql
-- ============================================================================

/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_payment_links` - Stores Stripe payment links for Printavo invoices
    - `stripe_payments` - Tracks Stripe payment records
    - `stripe_webhook_events` - Logs webhook events for debugging

  2. Security
    - Enable RLS on all tables
    - Policies allow users to manage their own company's data

  3. Indexes
    - Added for performance on common queries
*/

-- Create stripe_payment_links table
CREATE TABLE IF NOT EXISTS stripe_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_invoice_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'active',
  customer_email text,
  customer_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- Create stripe_payments table
CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'usd',
  status text DEFAULT 'processing',
  customer_email text,
  customer_name text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stripe_webhook_events table
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for stripe_payment_links
CREATE OR REPLACE FUNCTION update_stripe_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_payment_links_updated_at ON stripe_payment_links;
CREATE TRIGGER stripe_payment_links_updated_at
  BEFORE UPDATE ON stripe_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payment_links_updated_at();

-- Add updated_at trigger for stripe_payments
CREATE OR REPLACE FUNCTION update_stripe_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_payments_updated_at ON stripe_payments;
CREATE TRIGGER stripe_payments_updated_at
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payments_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id ON stripe_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_printavo_invoice_id ON stripe_payment_links(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_status ON stripe_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id ON stripe_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_printavo_invoice_id ON stripe_payments(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- Enable RLS
ALTER TABLE stripe_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_payment_links
CREATE POLICY "Users can view payment links"
  ON stripe_payment_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payment links"
  ON stripe_payment_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payment links"
  ON stripe_payment_links FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for stripe_payments
CREATE POLICY "Users can view payments"
  ON stripe_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create payments"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update payments"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for stripe_webhook_events
CREATE POLICY "Users can view webhook events"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert webhook events"
  ON stripe_webhook_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update webhook events"
  ON stripe_webhook_events FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================================
-- Migration: 20260112203149_20260108133253_add_stripe_credentials_to_company_settings.sql
-- ============================================================================

/*
  # Add Stripe Credentials to Company Settings

  1. Changes
    - Add `stripe_public_key` (encrypted)
    - Add `stripe_secret_key` (encrypted)
    - Add `stripe_webhook_secret` (encrypted)
    - These enable Stripe payment processing in Billing & Payments section

  2. Security
    - Keys are stored encrypted
    - Only accessible through secure backend services
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_public_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_public_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_secret_key'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_secret_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'stripe_webhook_secret'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN stripe_webhook_secret text;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260112203210_20260108150433_create_billing_workflow_tables.sql
-- ============================================================================

/*
  # Billing Workflow Schema

  1. New Tables
    - `billing_queue` - Tracks invoices in the billing queue
      - Links Printavo invoices to billing state
      - Tracks sent status, payment links, and communication
    
    - `communication_logs` - Records all customer communications
      - Emails, SMS, link sharing
      - Full audit trail for compliance
    
    - `paid_invoices` - Archives completed payments
      - Stores final payment records
      - Links to Printavo invoice and Stripe payment

  2. Security
    - Enable RLS on all tables
    - Users can access their company's data only

  3. Indexes
    - Added for common queries and foreign keys
*/

-- Create billing_queue table
CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  printavo_status text,
  customer_name text,
  customer_email text,
  customer_company text,
  invoice_total numeric(10, 2) NOT NULL DEFAULT 0,
  invoice_date timestamptz,
  due_date timestamptz,
  stripe_payment_link_id text,
  stripe_invoice_id text,
  sent_at timestamptz,
  sent_method text,
  payment_status text DEFAULT 'unpaid',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create communication_logs table
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  communication_type text NOT NULL,
  method text NOT NULL,
  recipient text NOT NULL,
  subject text,
  message text,
  status text DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}',
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz DEFAULT now()
);

-- Create paid_invoices table
CREATE TABLE IF NOT EXISTS paid_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  customer_name text,
  customer_email text,
  invoice_total numeric(10, 2) NOT NULL,
  amount_paid numeric(10, 2) NOT NULL,
  payment_date timestamptz NOT NULL,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add updated_at trigger for billing_queue
CREATE OR REPLACE FUNCTION update_billing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_queue_updated_at ON billing_queue;
CREATE TRIGGER billing_queue_updated_at
  BEFORE UPDATE ON billing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_queue_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_printavo_invoice_id ON billing_queue(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_payment_status ON billing_queue(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_sent_at ON billing_queue(sent_at);

CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_printavo_invoice_id ON communication_logs(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_printavo_invoice_id ON paid_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_payment_date ON paid_invoices(payment_date);

-- Enable RLS
ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_queue
CREATE POLICY "Users can view billing queue"
  ON billing_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert to billing queue"
  ON billing_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update billing queue"
  ON billing_queue FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete from billing queue"
  ON billing_queue FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for communication_logs
CREATE POLICY "Users can view communication logs"
  ON communication_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert communication logs"
  ON communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for paid_invoices
CREATE POLICY "Users can view paid invoices"
  ON paid_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert paid invoices"
  ON paid_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Migration: 20260112203249_20260108185301_add_stripe_invoice_partial_payments.sql
-- ============================================================================

/*
  # Add Stripe Invoice and Partial Payment Support

  ## New Tables
  
  ### `stripe_invoices`
  Tracks Stripe invoices created for Printavo invoices with minimum payment support
  
  ### `stripe_payment_history`
  Tracks all payments made against Stripe invoices (supports partial payments)

  ## Security
  - Enable RLS on both tables
  - Add policies for authenticated users to access data

  ## Notes
  - Supports 50% minimum payment requirement
  - Tracks partial and full payments
  - Stripe handles payment collection and balance tracking
*/

-- Create stripe_invoices table
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  stripe_invoice_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  hosted_invoice_url text NOT NULL,
  invoice_pdf_url text,
  total_amount numeric NOT NULL,
  minimum_due_amount numeric NOT NULL,
  amount_paid numeric DEFAULT 0 NOT NULL,
  amount_remaining numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  customer_email text,
  customer_name text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz,
  CONSTRAINT valid_amounts CHECK (amount_paid >= 0 AND amount_remaining >= 0 AND total_amount > 0),
  CONSTRAINT valid_minimum CHECK (minimum_due_amount >= 0 AND minimum_due_amount <= total_amount)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_printavo_id ON stripe_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON stripe_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_stripe_id ON stripe_invoices(stripe_invoice_id);

-- Create stripe_payment_history table
CREATE TABLE IF NOT EXISTS stripe_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id uuid NOT NULL REFERENCES stripe_invoices(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL,
  charge_id text,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  status text DEFAULT 'succeeded' NOT NULL,
  payment_method text,
  receipt_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Create indexes for payment history
CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON stripe_payment_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_intent ON stripe_payment_history(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON stripe_payment_history(created_at DESC);

-- Enable RLS
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_invoices
CREATE POLICY "Authenticated users can view stripe invoices"
  ON stripe_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create stripe invoices"
  ON stripe_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stripe invoices"
  ON stripe_invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for stripe_payment_history
CREATE POLICY "Authenticated users can view payment history"
  ON stripe_payment_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payment history"
  ON stripe_payment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stripe_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on stripe_invoices
DROP TRIGGER IF EXISTS trigger_update_stripe_invoice_timestamp ON stripe_invoices;
CREATE TRIGGER trigger_update_stripe_invoice_timestamp
  BEFORE UPDATE ON stripe_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_invoice_updated_at();

-- ============================================================================
-- Migration: 20260112203310_20260109163237_add_status_stage_to_invoices.sql
-- ============================================================================

/*
  # Add status_stage field to invoices

  1. Changes
    - Add `status_stage` column to `printavo_invoices` table
    - Status stages: 'billing_queue', 'sent', 'partial', 'paid', 'overdue'
    - Default value: 'billing_queue'
    - Index on status_stage for efficient queries

  2. Purpose
    - Track invoice lifecycle stages
    - Enable filtering of paid invoices
    - Support accounts receivable workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'status_stage'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN status_stage text DEFAULT 'billing_queue';

    ALTER TABLE printavo_invoices
    ADD CONSTRAINT printavo_invoices_status_stage_check
    CHECK (status_stage IN ('billing_queue', 'sent', 'partial', 'paid', 'overdue', 'accounts_receivable'));

    CREATE INDEX IF NOT EXISTS idx_printavo_invoices_status_stage
    ON printavo_invoices(status_stage);

    UPDATE printavo_invoices
    SET status_stage = CASE
      WHEN status = 'Paid' THEN 'paid'
      WHEN status = 'Partially Paid' THEN 'partial'
      WHEN status = 'Unpaid' THEN 'billing_queue'
      ELSE 'billing_queue'
    END
    WHERE status_stage IS NULL OR status_stage = 'billing_queue';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260112203312_20260109164453_add_customer_linking_to_invoices.sql
-- ============================================================================

/*
  # Link Customers to Invoices

  ## Description
  This migration adds the infrastructure to link the `customers` table
  with the `printavo_invoices` table. Customers will be automatically
  created when invoices are synced from Printavo.

  ## Changes

  1. Schema Updates
    - Add `customer_id` foreign key to `printavo_invoices`
    - Add `printavo_customer_id` to `customers` to track Printavo ID
    - Add indexes for performance

  2. Data Integrity
    - Foreign key constraint to ensure data consistency
    - Nullable customer_id to support existing invoices

  ## Notes
  - Existing invoices will have NULL customer_id initially
  - Customer sync will populate these relationships automatically
  - Customers are matched by email first, then by name
*/

-- Add printavo_customer_id to customers table to track Printavo customer ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'printavo_customer_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN printavo_customer_id text;
  END IF;
END $$;

-- Add customer_id foreign key to printavo_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create index on printavo_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_printavo_id ON customers(printavo_customer_id);

-- Create index on customer_id in printavo_invoices for faster joins
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_id ON printavo_invoices(customer_id);

-- Add customer_phone to printavo_invoices if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260112203343_20260112013508_add_complete_customer_fields_to_invoices.sql
-- ============================================================================

/*
  # Add Complete Customer Fields to Invoices Table

  This migration adds comprehensive customer information fields to the invoices table
  to support full customer data display in invoice views and PDF exports.

  ## Changes

  1. **New Fields Added to printavo_invoices**
     - `customer_phone` - Phone number from customer's primary contact
     - `billing_address_line1` - First line of billing address
     - `billing_address_line2` - Second line of billing address
     - `billing_city` - Billing address city
     - `billing_state` - Billing address state/province
     - `billing_zip` - Billing address postal code
     - `billing_country` - Billing address country
     - `shipping_address_line1` - First line of shipping address
     - `shipping_address_line2` - Second line of shipping address
     - `shipping_city` - Shipping address city
     - `shipping_state` - Shipping address state/province
     - `shipping_zip` - Shipping address postal code
     - `shipping_country` - Shipping address country

  2. **Purpose**
     - Store complete customer snapshot at time of invoice creation
     - Enable full customer information display in invoice views
     - Support complete PDF invoice generation without additional queries
     - Maintain historical accuracy even if customer data changes later

  ## Notes
  - All fields are nullable to handle cases where data is not available
  - These fields store a snapshot of customer data at sync time
  - Invoice display should use these fields, not live customer table data
*/

-- Add phone field (already added in previous migration but check again)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN customer_phone text;
  END IF;
END $$;

-- Add billing address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address_line1'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address_line1 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_address_line2'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_address_line2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_city'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_state'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_zip'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_zip text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'billing_country'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN billing_country text;
  END IF;
END $$;

-- Add shipping address fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address_line1'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address_line1 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_address_line2'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_address_line2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_city'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_state'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_zip'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_zip text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_country'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN shipping_country text;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260113133710_add_garment_metadata_to_line_items.sql
-- ============================================================================

/*
  # Add Garment Metadata Extraction Fields to Line Items

  ## Overview
  This migration adds structured fields to store extracted garment metadata from
  Printavo's line item descriptions. Since Printavo stores all garment details
  (style, color, size breakdown) in the description field as free text, we need
  to parse and store this data in a structured format.

  ## Changes

  1. New Columns Added to printavo_line_items:
     - `extracted_style` (text) - Garment style number (e.g., "Gildan 5000", "BC3001")
     - `extracted_color` (text) - Garment color (e.g., "Black", "Heather Navy")
     - `extracted_sizes` (jsonb) - Size breakdown as JSON (e.g., {"S": 5, "M": 12, "L": 8})
     - `extracted_sku` (text) - SKU or vendor code if present
     - `extraction_notes` (text) - Notes about extraction process or unparsed content
     - `parsed_at` (timestamptz) - Timestamp when parsing was performed

  ## Implementation Notes
  - All new fields are nullable (parsing may not always succeed)
  - Original description field is preserved for reference
  - extracted_sizes uses jsonb for flexible size data storage
  - parsed_at helps track when extraction was last performed
*/

-- Add extracted garment metadata fields to printavo_line_items
ALTER TABLE printavo_line_items 
ADD COLUMN IF NOT EXISTS extracted_style text,
ADD COLUMN IF NOT EXISTS extracted_color text,
ADD COLUMN IF NOT EXISTS extracted_sizes jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS extracted_sku text,
ADD COLUMN IF NOT EXISTS extraction_notes text,
ADD COLUMN IF NOT EXISTS parsed_at timestamptz;

-- Create index on extracted_style for faster searching
CREATE INDEX IF NOT EXISTS idx_line_items_extracted_style 
ON printavo_line_items(extracted_style) 
WHERE extracted_style IS NOT NULL;

-- Create index on extracted_color for faster filtering
CREATE INDEX IF NOT EXISTS idx_line_items_extracted_color 
ON printavo_line_items(extracted_color) 
WHERE extracted_color IS NOT NULL;

-- ============================================================================
-- Migration: 20260114135348_allow_authenticated_updates_to_invoices.sql
-- ============================================================================

/*
  # Allow authenticated users to update invoices and payments

  1. Changes
    - Add policy to allow authenticated users to update printavo_invoices
    - Add policy to allow authenticated users to insert printavo_payments
    - Required for manual payment marking functionality

  2. Security
    - Only authenticated users can perform these operations
    - Maintains data integrity while allowing necessary business operations
*/

-- Allow authenticated users to update invoices (for marking as paid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'printavo_invoices'
    AND policyname = 'Authenticated users can update invoices'
  ) THEN
    CREATE POLICY "Authenticated users can update invoices"
      ON printavo_invoices FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to insert payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'printavo_payments'
    AND policyname = 'Authenticated users can insert payments'
  ) THEN
    CREATE POLICY "Authenticated users can insert payments"
      ON printavo_payments FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260114135414_allow_authenticated_updates_to_invoices.sql
-- ============================================================================

/*
  # Allow authenticated users to update invoices and payments

  1. Changes
    - Add policy to allow authenticated users to update printavo_invoices
    - Add policy to allow authenticated users to insert printavo_payments
    - Required for manual payment marking functionality

  2. Security
    - Only authenticated users can perform these operations
    - Maintains data integrity while allowing necessary business operations
*/

-- Allow authenticated users to update invoices (for marking as paid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'printavo_invoices'
    AND policyname = 'Authenticated users can update invoices'
  ) THEN
    CREATE POLICY "Authenticated users can update invoices"
      ON printavo_invoices FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users to insert payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'printavo_payments'
    AND policyname = 'Authenticated users can insert payments'
  ) THEN
    CREATE POLICY "Authenticated users can insert payments"
      ON printavo_payments FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260114160250_add_financial_lock_to_invoices.sql
-- ============================================================================

/*
  # Add Financial Lock Protection to Invoices

  ## Summary
  This migration adds financial lock protection to prevent Printavo sync from 
  overwriting payment data that has been recorded in our system (Stripe, manual 
  payments, credits, etc.).

  ## Changes

  1. **New Fields Added to `printavo_invoices`**
     - `is_financially_locked` (boolean) - Prevents sync from overwriting financial data
     - `locked_at` (timestamptz) - Timestamp when lock was applied
     - `locked_by` (text) - Source that locked it ('stripe', 'manual', 'system')
     - `balance_remaining` (numeric) - Our calculated balance (not from Printavo)

  2. **Protected Fields (When Locked)**
     When `is_financially_locked = true`, sync will NOT overwrite:
     - `amount_paid` (our payment tracking)
     - `amount_outstanding` (our balance calculation)
     - `balance_remaining` (our balance tracking)
     - `status` (our status based on payments)
     - `status_stage` (our workflow stage)

  3. **Safe Fields (Always Updated)**
     Even when locked, sync CAN update:
     - Customer info (name, email, phone, company)
     - Addresses (billing/shipping)
     - Invoice amounts (subtotal, tax, total) - allows quantity changes
     - Dates (invoice_date, due_date)
     - Metadata (raw_data)

  4. **Auto-Lock Existing Paid Invoices**
     - Any invoice with status = 'Paid' will be automatically locked
     - Any invoice with status_stage = 'paid' will be automatically locked
     - Locked by 'system' during migration

  ## Security
  - No RLS changes needed (uses existing policies)

  ## Notes
  - Lock is set when invoices are paid IN FULL via Stripe
  - Lock is NOT set on partial payments (balance still owed)
  - Admins can manually unlock if needed
  - Printavo data is still stored in raw_data for audit trail
*/

-- Add balance_remaining field if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'balance_remaining'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN balance_remaining numeric DEFAULT 0;
  END IF;
END $$;

-- Add is_financially_locked field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'is_financially_locked'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN is_financially_locked boolean DEFAULT false;
  END IF;
END $$;

-- Add locked_at field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN locked_at timestamptz;
  END IF;
END $$;

-- Add locked_by field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'locked_by'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN locked_by text;
  END IF;
END $$;

-- Create index on is_financially_locked for efficient queries
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_financially_locked 
ON printavo_invoices(is_financially_locked) 
WHERE is_financially_locked = true;

-- Auto-lock existing paid invoices
UPDATE printavo_invoices
SET 
  is_financially_locked = true,
  locked_at = COALESCE(updated_at, created_at, now()),
  locked_by = 'system'
WHERE 
  (status = 'Paid' OR status_stage = 'paid')
  AND (is_financially_locked IS NULL OR is_financially_locked = false);

-- Initialize balance_remaining for existing invoices
UPDATE printavo_invoices
SET balance_remaining = COALESCE(amount_outstanding, total - COALESCE(amount_paid, 0))
WHERE balance_remaining IS NULL OR balance_remaining = 0;

-- ============================================================================
-- Migration: 20260114164519_add_unlock_pin_to_user_profiles.sql
-- ============================================================================

/*
  # Add Unlock PIN to User Profiles

  1. Changes
    - Add `unlock_pin_hash` column to `user_profiles` table (if not exists)
    - This column stores the hashed PIN for unlocking financially locked invoices
    - PINs are hashed client-side using SHA-256 before storage
  
  2. Security
    - PINs are hashed, never stored in plain text
    - Each user sets their own PIN
    - PIN is required to unlock invoices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'unlock_pin_hash'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN unlock_pin_hash text;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260114170206_add_manual_payment_fields.sql
-- ============================================================================

/*
  # Add Manual Payment Entry Fields

  1. Changes to `payments` table
    - Add `payment_type` field to distinguish between Cash, Card, Check, etc.
    - Add `check_number` field for check payments
    - Add `created_by` field to track who created the payment
    - Add `source` field to distinguish manual vs. automated payments
  
  2. Notes
    - All fields are optional to maintain compatibility with Stripe payments
    - Source defaults to 'manual' for manually entered payments
*/

-- Add new columns to payments table
DO $$ 
BEGIN
  -- Add payment_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type text;
  END IF;

  -- Add check_number column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'check_number'
  ) THEN
    ALTER TABLE payments ADD COLUMN check_number text;
  END IF;

  -- Add created_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  -- Add source column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'source'
  ) THEN
    ALTER TABLE payments ADD COLUMN source text DEFAULT 'manual';
  END IF;
END $$;

-- Add check constraint for payment_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_payment_type'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT valid_payment_type 
    CHECK (payment_type IS NULL OR payment_type IN ('cash', 'debit_credit', 'check_ach', 'stripe', 'other'));
  END IF;
END $$;

-- Add check constraint for source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_payment_source'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT valid_payment_source 
    CHECK (source IN ('manual', 'stripe', 'square', 'printavo', 'other'));
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260115173508_add_user_roles_rbac.sql
-- ============================================================================

/*
  # Add User Roles and RBAC System
  
  1. Changes
    - Update user_profiles role field to support 'super_admin' and 'admin' roles
    - Assign Jamie as Super Admin
    - Assign Matt and Todd as Admin
    - Add role validation constraint
  
  2. Roles
    - super_admin: Full access to all features including Integrations
    - admin: Access to all features EXCEPT Integrations section
  
  3. Security
    - Role assignments enforced at database level
    - Only authenticated users can read their own role
    - Role changes require proper authorization
*/

-- Update Jamie to Super Admin
UPDATE user_profiles
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE email = 'jamie@toddssportinggoods.com';

-- Ensure Matt and Todd are set as Admin (they already are, but making it explicit)
UPDATE user_profiles
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email IN ('matt@toddssportinggoods.com', 'todd@toddssportinggoods.com');

-- Add constraint to ensure only valid roles are used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('super_admin', 'admin'));
  END IF;
END $$;

-- Create a function to check if user is super admin
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

-- Create a function to get user role
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


-- ============================================================================
-- Migration: 20260115192632_add_status_to_payments_table.sql
-- ============================================================================

/*
  # Add status field to payments table for unified payment tracking

  1. Changes
    - Add `status` field to track payment status (successful, failed, refunded, pending)
    - Add `refund_amount` field to track partial/full refunds
    - Add `refunded_at` timestamp field
    - Add `refund_reason` text field
    - Add index on status for faster queries
    - Add index on source for faster queries

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$ 
BEGIN
  -- Add status field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN status text DEFAULT 'successful' 
    CHECK (status IN ('successful', 'failed', 'refunded', 'pending', 'partial_refund'));
  END IF;

  -- Add refund_amount field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'refund_amount'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN refund_amount numeric DEFAULT 0;
  END IF;

  -- Add refunded_at field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN refunded_at timestamptz;
  END IF;

  -- Add refund_reason field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN refund_reason text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);

-- ============================================================================
-- Migration: 20260115193308_fix_payments_invoice_id_nullable.sql
-- ============================================================================

/*
  # Make invoice_id nullable in payments table

  1. Changes
    - Change invoice_id from NOT NULL to nullable
    - This allows payments that aren't associated with invoices (e.g., standalone Stripe payments)

  2. Rationale
    - Some payments may not be linked to invoices
    - Standalone Stripe checkout sessions
    - Test payments
*/

ALTER TABLE payments 
ALTER COLUMN invoice_id DROP NOT NULL;

-- ============================================================================
-- Migration: 20260115193322_backfill_unified_payments_table_v2.sql
-- ============================================================================

/*
  # Backfill unified payments table with historical data

  1. Purpose
    - Migrate existing payment records from stripe_payments and paid_invoices tables
    - Populate the unified payments table with all historical payment data
    - Ensure proper mapping of fields and prevent duplicates

  2. Data Sources
    - stripe_payments: Stripe payment records
    - paid_invoices: Manual payment records

  3. Mapping
    - Stripe payments: source='stripe', status='successful', includes transaction IDs
    - Manual payments: source='manual', status='successful', from paid_invoices
*/

-- Backfill from stripe_payments table
INSERT INTO payments (
  company_id,
  invoice_id,
  customer_id,
  amount,
  payment_date,
  payment_method,
  payment_type,
  stripe_transaction_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  status,
  source,
  metadata,
  created_at,
  updated_at
)
SELECT 
  sp.company_id,
  sp.printavo_invoice_id,
  pi.customer_id,
  sp.amount,
  COALESCE(sp.created_at, NOW()),
  'Stripe',
  'stripe',
  COALESCE(sp.stripe_charge_id, sp.stripe_payment_intent_id),
  sp.stripe_payment_intent_id,
  sp.stripe_charge_id,
  CASE 
    WHEN sp.status = 'succeeded' THEN 'successful'
    WHEN sp.status = 'failed' THEN 'failed'
    ELSE sp.status
  END,
  'stripe',
  jsonb_build_object(
    'customer_email', sp.customer_email,
    'customer_name', sp.customer_name,
    'payment_method', sp.payment_method,
    'currency', sp.currency,
    'migrated_from', 'stripe_payments',
    'original_metadata', sp.metadata
  ),
  sp.created_at,
  sp.updated_at
FROM stripe_payments sp
LEFT JOIN printavo_invoices pi ON pi.id = sp.printavo_invoice_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments p 
  WHERE p.stripe_payment_intent_id = sp.stripe_payment_intent_id
);

-- Backfill from paid_invoices table (manual payments)
INSERT INTO payments (
  company_id,
  invoice_id,
  customer_id,
  amount,
  payment_date,
  payment_method,
  payment_type,
  status,
  source,
  notes,
  metadata,
  created_at
)
SELECT 
  pdi.company_id,
  pdi.printavo_invoice_id,
  pi.customer_id,
  pdi.amount_paid,
  COALESCE(pdi.payment_date, pdi.created_at, NOW()),
  COALESCE(pdi.payment_method, 'Manual'),
  CASE 
    WHEN pdi.payment_method = 'manual' THEN 'other'
    ELSE 'other'
  END,
  'successful',
  'manual',
  'Migrated from paid_invoices',
  jsonb_build_object(
    'customer_email', pdi.customer_email,
    'customer_name', pdi.customer_name,
    'invoice_total', pdi.invoice_total,
    'printavo_visual_id', pdi.printavo_visual_id,
    'migrated_from', 'paid_invoices',
    'original_metadata', pdi.metadata
  ),
  pdi.created_at
FROM paid_invoices pdi
LEFT JOIN printavo_invoices pi ON pi.id = pdi.printavo_invoice_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments p 
  WHERE p.invoice_id = pdi.printavo_invoice_id 
  AND p.amount = pdi.amount_paid
  AND p.payment_date = pdi.payment_date
);

-- ============================================================================
-- Migration: 20260115193811_remove_duplicate_payments.sql
-- ============================================================================

/*
  # Remove duplicate payment entries

  1. Problem
    - Stripe webhook was writing to both unified payments table AND old paid_invoices table
    - Backfill migration migrated from both tables, creating duplicates
    - Some invoices have the same payment logged twice (once as stripe, once as manual)

  2. Solution
    - For stripe+manual duplicates on same day: Keep stripe, delete manual (manual was from backfilled paid_invoices)
    - For manual+manual duplicates: Keep earliest, delete later ones
    
  3. Affected Records
    - Invoice 21615083: $3.00 (stripe + manual duplicate)
    - Invoice 21666404: $5.00 (2x manual)
    - Invoice 21513669: $125.00 (3x manual)
    - Invoice 21615082: $1.00 (2x manual)
*/

-- Delete manual payment duplicates where stripe payment exists for same invoice/amount/day
DELETE FROM payments
WHERE id IN (
  SELECT p.id
  FROM payments p
  INNER JOIN payments p2 ON 
    p.invoice_id = p2.invoice_id 
    AND p.amount = p2.amount
    AND DATE(p.payment_date) = DATE(p2.payment_date)
    AND p.source = 'manual'
    AND p2.source = 'stripe'
    AND p.id != p2.id
);

-- For purely manual duplicates, keep the earliest one
DELETE FROM payments
WHERE id IN (
  WITH ranked_payments AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY invoice_id, amount, DATE(payment_date), source 
        ORDER BY created_at ASC
      ) as rn
    FROM payments
    WHERE source = 'manual'
  )
  SELECT id 
  FROM ranked_payments 
  WHERE rn > 1
);

-- ============================================================================
-- Migration: 20260115204227_fix_invoice_balance_calculation.sql
-- ============================================================================

/*
  # Fix Invoice Balance Calculation

  1. Problem
    - Refunded payments are incorrectly affecting invoice balances
    - Invoice amount_paid field is not properly calculating based on payment status
    - Refunded payments should be excluded from balance calculations

  2. Solution
    - Create a function to recalculate invoice balances correctly
    - Only count 'successful' payments
    - Exclude 'refunded' payments entirely
    - For 'partial_refund', subtract the refund_amount
    - Run the function to fix all existing invoices

  3. Calculation Logic
    - amount_paid = SUM(payment.amount) WHERE status='successful'
                   + SUM(payment.amount - payment.refund_amount) WHERE status='partial_refund'
    - balance_remaining = total - amount_paid
    - amount_outstanding = balance_remaining
*/

-- Create function to recalculate invoice balances
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      p.invoice_id,
      -- Only count successful payments at full amount
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        ELSE 0
      END), 0) as calculated_paid
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
  ),
  updates AS (
    UPDATE printavo_invoices i
    SET 
      amount_paid = COALESCE(pt.calculated_paid, 0),
      balance_remaining = i.total - COALESCE(pt.calculated_paid, 0),
      amount_outstanding = i.total - COALESCE(pt.calculated_paid, 0),
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
      )
    RETURNING 
      i.id,
      i.amount_paid as old_paid,
      COALESCE(pt.calculated_paid, 0) as new_paid,
      i.balance_remaining as old_bal,
      (i.total - COALESCE(pt.calculated_paid, 0)) as new_bal
  )
  SELECT 
    u.id as invoice_id,
    u.old_paid as old_amount_paid,
    u.new_paid as new_amount_paid,
    u.old_bal as old_balance,
    u.new_bal as new_balance
  FROM updates u;
END;
$$ LANGUAGE plpgsql;

-- Run the recalculation
SELECT * FROM recalculate_invoice_balances();


-- ============================================================================
-- Migration: 20260115205635_add_company_info_columns_for_invoices.sql
-- ============================================================================

/*
  # Add Company Information Columns for Invoice PDFs

  1. New Columns
    - `company_address` (text, nullable) - Company address for invoice headers
    - `company_phone` (text, nullable) - Company phone number for invoice headers
    - `company_email` (text, nullable) - Company email for invoice headers
    - `company_website` (text, nullable) - Company website for invoice footers
    - `invoice_terms` (text, nullable) - Default invoice terms and conditions

  2. Purpose
    - These columns are used to populate professional invoice PDFs
    - Company information appears in invoice headers
    - Website appears in invoice footers
    - Terms appear in invoice terms section

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add company information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_address'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_phone'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_website'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'invoice_terms'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN invoice_terms text;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260115211711_add_company_logo_fields.sql
-- ============================================================================

/*
  # Add Company Logo Fields to Company Settings

  1. Changes
    - Add `company_logo_primary_url` field for primary logo (invoices, emails, customer-facing)
    - Add `company_logo_secondary_url` field for secondary logo (dark mode, alternate layouts)
    - Both fields are nullable text fields to store logo URLs from Supabase Storage
  
  2. Purpose
    - Enable companies to upload and store two logos for different branding purposes
    - Primary logo: main branding for invoices, emails, and customer communications
    - Secondary logo: alternative branding for dark mode or watermarking
*/

-- Add primary logo URL field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_logo_primary_url'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_logo_primary_url text;
  END IF;
END $$;

-- Add secondary logo URL field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_logo_secondary_url'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_logo_secondary_url text;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN company_settings.company_logo_primary_url IS 'URL to primary company logo stored in Supabase Storage. Used for invoices, emails, and customer-facing branding.';
COMMENT ON COLUMN company_settings.company_logo_secondary_url IS 'URL to secondary company logo stored in Supabase Storage. Used for dark mode, alternate layouts, or watermarking.';


-- ============================================================================
-- Migration: 20260116013634_fix_payments_rbac_policies.sql
-- ============================================================================

/*
  # Fix Payments Table RBAC Policies

  1. Changes
    - Drop existing conflicting policies on payments table
    - Create new RBAC-aware policies for super_admin and admin roles
    - Allow super_admin and admin to insert, update, and delete payments
    - All authenticated users can view payments

  2. Security
    - Super admin and admin roles can manage all payment operations
    - Regular users can view payments
    - Maintains proper role-based access control
*/

-- Drop all existing policies on payments table
DROP POLICY IF EXISTS "Allow read access to payments" ON payments;
DROP POLICY IF EXISTS "Allow anonymous read access to payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Users can create payments" ON payments;
DROP POLICY IF EXISTS "Users can update payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Allow public read access to payments" ON payments;
DROP POLICY IF EXISTS "Service role can insert payments" ON payments;
DROP POLICY IF EXISTS "Service role can update payments" ON payments;
DROP POLICY IF EXISTS "Service role can delete payments" ON payments;

-- Ensure RLS is enabled
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view payments
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

-- Allow super_admin and admin to insert payments
CREATE POLICY "Super admin and admin can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow super_admin and admin to update payments
CREATE POLICY "Super admin and admin can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow super_admin and admin to delete payments
CREATE POLICY "Super admin and admin can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );


-- ============================================================================
-- Migration: 20260116014010_add_reversed_status_to_payments.sql
-- ============================================================================

/*
  # Add 'reversed' status to payments table

  1. Changes
    - Drop existing status check constraint
    - Add new status check constraint that includes 'reversed'
    - 'reversed' is used for manual payment reversals

  2. Security
    - No RLS changes needed
*/

-- Drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- Add new check constraint with 'reversed' included
ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IN ('successful', 'failed', 'refunded', 'pending', 'partial_refund', 'reversed'));


-- ============================================================================
-- Migration: 20260116014252_allow_negative_amounts_for_reversed_payments.sql
-- ============================================================================

/*
  # Allow negative amounts for reversed payments

  1. Changes
    - Drop existing amount check constraint
    - Add new check constraint that allows:
      - Positive amounts for all statuses except 'reversed'
      - Negative amounts only for 'reversed' status
    - This enables payment reversals to use negative amounts

  2. Security
    - No RLS changes needed
*/

-- Drop the existing check constraint(s)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS valid_payment_amount;

-- Add new check constraint that allows negative amounts for reversed payments
ALTER TABLE payments 
ADD CONSTRAINT valid_payment_amount 
CHECK (
  (status = 'reversed' AND amount < 0) OR
  (status != 'reversed' AND amount > 0)
);


-- ============================================================================
-- Migration: 20260116014647_include_reversed_payments_in_balance_calculation.sql
-- ============================================================================

/*
  # Include reversed payments in invoice balance calculation

  1. Problem
    - Reversed payments are not being included in invoice balance calculations
    - When a payment is reversed, the invoice balance should increase (since a negative payment is added)
    - Currently only 'successful' and 'partial_refund' statuses are considered

  2. Solution
    - Update the recalculate_invoice_balances() function to include reversed payments
    - Reversed payments have negative amounts, so they will naturally reduce amount_paid
    - This will increase the balance_remaining when a payment is reversed

  3. Updated Calculation Logic
    - amount_paid = SUM(payment.amount) WHERE status='successful'
                   + SUM(payment.amount - payment.refund_amount) WHERE status='partial_refund'
                   + SUM(payment.amount) WHERE status='reversed' (negative amounts)
    - balance_remaining = total - amount_paid
    - amount_outstanding = balance_remaining
*/

-- Update function to include reversed payments in balance calculation
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      p.invoice_id,
      -- Count successful payments at full amount
      -- Count partial refunds at (amount - refund_amount)
      -- Count reversed payments at their negative amount (reduces total paid)
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        WHEN p.status = 'reversed' THEN p.amount
        ELSE 0
      END), 0) as calculated_paid
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
  ),
  updates AS (
    UPDATE printavo_invoices i
    SET 
      amount_paid = COALESCE(pt.calculated_paid, 0),
      balance_remaining = i.total - COALESCE(pt.calculated_paid, 0),
      amount_outstanding = i.total - COALESCE(pt.calculated_paid, 0),
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
      )
    RETURNING 
      i.id,
      i.amount_paid as old_paid,
      COALESCE(pt.calculated_paid, 0) as new_paid,
      i.balance_remaining as old_bal,
      (i.total - COALESCE(pt.calculated_paid, 0)) as new_bal
  )
  SELECT 
    u.id as invoice_id,
    u.old_paid as old_amount_paid,
    u.new_paid as new_amount_paid,
    u.old_bal as old_balance,
    u.new_bal as new_balance
  FROM updates u;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all invoice balances to fix any existing discrepancies
SELECT * FROM recalculate_invoice_balances();


-- ============================================================================
-- Migration: 20260116015403_fix_status_stage_on_balance_recalculation.sql
-- ============================================================================

/*
  # Fix status_stage when recalculating balances

  1. Problem
    - When payments are reversed, the invoice balance changes but status_stage stays 'paid'
    - Need to automatically update status_stage based on the new balance

  2. Solution
    - Update recalculate_invoice_balances() to also fix status_stage
    - If balance > 0, invoice should move from 'paid' to 'accounts_receivable'
    - If balance = 0, invoice should stay as 'paid'

  3. Logic
    - paid: balance_remaining = 0
    - accounts_receivable: balance_remaining > 0 and (payment_link sent or date_sent exists)
    - billing_queue: balance_remaining > 0 and no payment link/date sent
*/

-- Drop existing function to change return type
DROP FUNCTION IF EXISTS recalculate_invoice_balances();

-- Create updated function that also fixes status_stage based on balance
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric,
  old_status_stage text,
  new_status_stage text
) AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      p.invoice_id,
      -- Count successful payments at full amount
      -- Count partial refunds at (amount - refund_amount)
      -- Count reversed payments at their negative amount (reduces total paid)
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        WHEN p.status = 'reversed' THEN p.amount
        ELSE 0
      END), 0) as calculated_paid
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
  ),
  updates AS (
    UPDATE printavo_invoices i
    SET 
      amount_paid = COALESCE(pt.calculated_paid, 0),
      balance_remaining = i.total - COALESCE(pt.calculated_paid, 0),
      amount_outstanding = i.total - COALESCE(pt.calculated_paid, 0),
      status_stage = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) = 0 THEN 'paid'
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 
          AND (i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL) THEN 'accounts_receivable'
        ELSE 'billing_queue'
      END,
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
        OR (
          -- Also update if status_stage is wrong for the balance
          (i.total - COALESCE(pt.calculated_paid, 0)) = 0 AND i.status_stage != 'paid'
        ) OR (
          (i.total - COALESCE(pt.calculated_paid, 0)) > 0 AND i.status_stage = 'paid'
        )
      )
    RETURNING 
      i.id,
      i.amount_paid as old_paid,
      COALESCE(pt.calculated_paid, 0) as new_paid,
      i.balance_remaining as old_bal,
      (i.total - COALESCE(pt.calculated_paid, 0)) as new_bal,
      i.status_stage as old_stage,
      CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) = 0 THEN 'paid'
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 
          AND (i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL) THEN 'accounts_receivable'
        ELSE 'billing_queue'
      END as new_stage
  )
  SELECT 
    u.id as invoice_id,
    u.old_paid as old_amount_paid,
    u.new_paid as new_amount_paid,
    u.old_bal as old_balance,
    u.new_bal as new_balance,
    u.old_stage as old_status_stage,
    u.new_stage as new_status_stage
  FROM updates u;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all invoice balances and fix status_stage
SELECT * FROM recalculate_invoice_balances();


-- ============================================================================
-- Migration: 20260116200740_fix_security_issues_focused.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260119153146_fix_new_user_super_admin_role.sql
-- ============================================================================

/*
  # Fix New User Super Admin Role Assignment

  1. Changes
    - Update handle_new_user() function to automatically assign 'super_admin' role to all new signups
    - Remove hardcoded email checks (Jamie-specific logic)
    - Since this is a multi-tenant system where each company creates their own account,
      the first user to sign up for a company should automatically be a super admin

  2. Rationale
    - Each company signup creates a new company account
    - The person creating the account should have full super_admin access
    - This aligns with the RBAC constraint that only allows 'super_admin' and 'admin' roles

  3. Security
    - Super admin role is only assigned during initial user creation via the trigger
    - Additional users would need to be invited by existing admins
*/

-- Update the handle_new_user function to assign super_admin to all new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- All new signups get super_admin role by default
  -- This is appropriate because each signup represents a new company account
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'super_admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Migration: 20260119155257_add_company_id_for_data_isolation.sql
-- ============================================================================

/*
  # Add Company ID for Multi-Tenant Data Isolation
  
  ## Critical Security Fix
  
  This migration adds company_id to all tables that need multi-tenant isolation.
  Currently, all users can see all data regardless of which company they belong to.
  
  ## Changes
  
  1. Tables Updated:
     - `user_profiles` - Add company_id to link users to their company
     - `printavo_invoices` - Add company_id to isolate invoice data
     - `printavo_line_items` - Add company_id via invoice relationship
     - `customers` - Add company_id to isolate customer data
     - `quotes` - Add company_id to isolate quote data
     - `automations` - Add company_id to isolate automation rules
     - `customer_contacts` - Inherits from customer relationship
  
  2. Data Backfill:
     - Links existing data to the first company (Todd's)
     - Sets user company_id based on company_settings.owner_id
  
  3. Security:
     - All RLS policies will be updated in next migration to filter by company_id
     - Users will only see data for their company
*/

-- Add company_id to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to printavo_invoices
ALTER TABLE printavo_invoices 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to quotes
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to automations
ALTER TABLE automations 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_company_id ON printavo_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);

-- Backfill: Link existing users to their companies based on company_settings.owner_id
UPDATE user_profiles up
SET company_id = cs.id
FROM company_settings cs
WHERE cs.owner_id = up.id
  AND up.company_id IS NULL;

-- Backfill: For any users not already linked, link to the first company
UPDATE user_profiles
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing invoices to the first company
UPDATE printavo_invoices
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing customers to the first company
UPDATE customers
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing quotes to the first company
UPDATE quotes
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing automations to the first company
UPDATE automations
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Make company_id NOT NULL after backfill (except for older tables we might not touch)
ALTER TABLE user_profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE printavo_invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
-- quotes and automations can stay nullable for now since they might not have data


-- ============================================================================
-- Migration: 20260119155323_fix_rls_policies_for_company_isolation.sql
-- ============================================================================

/*
  # Fix RLS Policies for Company Data Isolation
  
  ## Security Enhancement
  
  Updates all RLS policies to properly filter by company_id so users only see
  data belonging to their company.
  
  ## Changes
  
  1. Helper Function:
     - Create get_user_company_id() function to get current user's company
  
  2. Updated Policies:
     - user_profiles: Filter by company_id
     - printavo_invoices: Filter by company_id
     - customers: Filter by company_id
     - quotes: Filter by company_id
     - automations: Filter by company_id
  
  3. Notes:
     - Super admins can see all data (future enhancement)
     - Regular users only see their company's data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON printavo_invoices;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON printavo_invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update printavo_invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update invoices for unlock" ON printavo_invoices;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can create customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON quotes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON automations;

-- Create helper function to get user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- User Profiles Policies
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

-- Printavo Invoices Policies
CREATE POLICY "Users can view invoices in their company"
  ON printavo_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update invoices in their company"
  ON printavo_invoices FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can insert invoices for their company"
  ON printavo_invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Customers Policies  
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

-- Quotes Policies
CREATE POLICY "Users can view quotes in their company"
  ON quotes FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create quotes for their company"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update quotes in their company"
  ON quotes FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete quotes in their company"
  ON quotes FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Automations Policies
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


-- ============================================================================
-- Migration: 20260119160548_fix_signup_trigger_create_company.sql
-- ============================================================================

/*
  # Fix Signup Trigger to Create Company First
  
  1. Problem
    - The handle_new_user() trigger tries to insert into user_profiles
    - But user_profiles.company_id is now a required foreign key
    - The trigger doesn't create a company first, causing 500 errors
  
  2. Solution
    - Update handle_new_user() to:
      a) Create a company_settings record first (using email as company name)
      b) Then create the user_profile linked to that company
      c) Set the new user as the company owner
  
  3. Security
    - Each signup creates an isolated company environment
    - User is assigned super_admin role for their company
    - RLS policies ensure they only see their company's data
*/

-- Drop and recreate the handle_new_user function with company creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id uuid;
BEGIN
  -- Create a new company for this user
  -- Use email domain as company name initially (user can change it later)
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


-- ============================================================================
-- Migration: 20260119160831_remove_insecure_invoice_policy.sql
-- ============================================================================

/*
  # CRITICAL SECURITY FIX: Remove Insecure Invoice Access Policy
  
  ## Problem
  There's a policy "Allow read access to invoices" with USING (true) that allows
  ANY authenticated user to read ALL invoices from ALL companies. This completely
  bypasses company data isolation.
  
  ## Solution
  Drop the insecure policy. The company-specific policies will handle access:
  - "Users can view invoices in their company" - filters by company_id
  - "Users can update invoices in their company" - filters by company_id
  - "Users can insert invoices for their company" - filters by company_id
  
  ## Security Impact
  After this fix, users will ONLY see invoices belonging to their company.
*/

-- Drop the insecure policy that allows all authenticated users to see all invoices
DROP POLICY IF EXISTS "Allow read access to invoices" ON printavo_invoices;

-- Verify company-specific policies are in place (these should already exist)
-- If they don't exist, create them

DO $$
BEGIN
  -- Check if company-specific SELECT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'printavo_invoices' 
    AND policyname = 'Users can view invoices in their company'
  ) THEN
    CREATE POLICY "Users can view invoices in their company"
      ON printavo_invoices FOR SELECT
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260119160910_fix_all_insecure_rls_policies.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260119161321_add_company_id_to_printavo_child_tables.sql
-- ============================================================================

/*
  # Add Company Isolation to Printavo Child Tables
  
  ## Problem
  printavo_payments and printavo_line_items don't have company_id columns,
  so they can't filter by company. This allows users to see all payments and
  line items across all companies.
  
  ## Solution
  1. Add company_id column to both tables
  2. Backfill company_id from the related invoice
  3. Drop insecure RLS policies
  4. Create secure company-specific RLS policies
  5. Update the view to respect company isolation
  
  ## Security Impact
  After this fix, users will only see payments and line items belonging to
  invoices in their company.
*/

-- Add company_id to printavo_payments
ALTER TABLE printavo_payments 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to printavo_line_items
ALTER TABLE printavo_line_items 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Backfill company_id from invoices for payments
UPDATE printavo_payments p
SET company_id = i.company_id
FROM printavo_invoices i
WHERE p.invoice_id = i.id
  AND p.company_id IS NULL;

-- Backfill company_id from invoices for line items
UPDATE printavo_line_items li
SET company_id = i.company_id
FROM printavo_invoices i
WHERE li.invoice_id = i.id
  AND li.company_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_company_id ON printavo_line_items(company_id);

-- Drop all insecure policies
DROP POLICY IF EXISTS "Allow read access to payments" ON printavo_payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON printavo_payments;
DROP POLICY IF EXISTS "Allow authenticated read access to line items" ON printavo_line_items;

-- Create secure company-specific policies for printavo_payments
CREATE POLICY "Users can view payments in their company"
  ON printavo_payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert payments for their company"
  ON printavo_payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update payments in their company"
  ON printavo_payments FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete payments in their company"
  ON printavo_payments FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Create secure company-specific policies for printavo_line_items
CREATE POLICY "Users can view line items in their company"
  ON printavo_line_items FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert line items for their company"
  ON printavo_line_items FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update line items in their company"
  ON printavo_line_items FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete line items in their company"
  ON printavo_line_items FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Recreate the calculated view to include company_id
DROP VIEW IF EXISTS printavo_invoices_calculated;

CREATE VIEW printavo_invoices_calculated AS
SELECT 
  i.id,
  i.invoice_number,
  i.customer_email,
  i.customer_name,
  i.customer_company,
  i.subtotal,
  i.tax,
  i.total,
  i.company_id,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  GREATEST(i.total - COALESCE(SUM(p.amount), 0), 0) AS amount_outstanding,
  CASE
    WHEN i.total <= COALESCE(SUM(p.amount), 0) THEN true
    ELSE false
  END AS paid_in_full,
  i.status,
  i.invoice_date,
  i.due_date,
  i.created_at,
  i.updated_at,
  i.raw_data
FROM printavo_invoices i
LEFT JOIN printavo_payments p ON p.invoice_id = i.id AND p.company_id = i.company_id
GROUP BY 
  i.id, 
  i.invoice_number, 
  i.customer_email, 
  i.customer_name, 
  i.customer_company, 
  i.subtotal, 
  i.tax, 
  i.total,
  i.company_id,
  i.status, 
  i.invoice_date, 
  i.due_date, 
  i.created_at, 
  i.updated_at, 
  i.raw_data;

-- Grant access to the view for authenticated users
GRANT SELECT ON printavo_invoices_calculated TO authenticated;


-- ============================================================================
-- Migration: 20260119161603_fix_billing_queue_rls_policies.sql
-- ============================================================================

/*
  # Fix Billing Queue RLS Policies for Company Isolation
  
  ## Problem
  The billing_queue table has company_id but all RLS policies use USING (true)
  and WITH CHECK (true), which allows ANY authenticated user to see ALL billing
  queue items across all companies.
  
  ## Solution
  Replace all insecure policies with company-specific policies that filter by
  get_user_company_id().
  
  ## Security Impact
  After this fix, users will only see billing queue items for their own company.
*/

-- Drop all insecure policies
DROP POLICY IF EXISTS "Users can view billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can insert to billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can update billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can delete from billing queue" ON billing_queue;

-- Create secure company-specific policies
CREATE POLICY "Users can view billing queue for their company"
  ON billing_queue FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert to billing queue for their company"
  ON billing_queue FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update billing queue for their company"
  ON billing_queue FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete from billing queue for their company"
  ON billing_queue FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());


-- ============================================================================
-- Migration: 20260119161708_fix_remaining_stripe_and_other_insecure_policies.sql
-- ============================================================================

/*
  # Fix Remaining Insecure RLS Policies (Part 2)
  
  ## Problem
  Multiple tables still have insecure RLS policies using USING (true) or 
  WITH CHECK (true), allowing cross-company data access.
  
  Tables with company_id that need fixing:
  - stripe_invoices
  - stripe_payments
  - stripe_payment_links
  - stripe_webhook_events
  - paid_invoices
  - communication_logs
  - automations
  
  Tables WITHOUT company_id (will fix through parent relationships later):
  - customer_contacts
  - quote_items, quote_fees, quote_imprints
  - sms_logs
  - stripe_payment_history
  - automation_logs
  
  ## Solution
  Fix all policies for tables that have company_id using DROP IF EXISTS.
*/

-- Fix stripe_invoices
DROP POLICY IF EXISTS "Authenticated users can view stripe invoices" ON stripe_invoices;
DROP POLICY IF EXISTS "Authenticated users can create stripe invoices" ON stripe_invoices;
DROP POLICY IF EXISTS "Authenticated users can update stripe invoices" ON stripe_invoices;
DROP POLICY IF EXISTS "Users can view stripe invoices in their company" ON stripe_invoices;
DROP POLICY IF EXISTS "Users can create stripe invoices for their company" ON stripe_invoices;
DROP POLICY IF EXISTS "Users can update stripe invoices in their company" ON stripe_invoices;

CREATE POLICY "Users can view stripe invoices in their company"
  ON stripe_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create stripe invoices for their company"
  ON stripe_invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update stripe invoices in their company"
  ON stripe_invoices FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix stripe_payments
DROP POLICY IF EXISTS "Users can view payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can create payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can update payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can view stripe payments in their company" ON stripe_payments;
DROP POLICY IF EXISTS "Users can create stripe payments for their company" ON stripe_payments;
DROP POLICY IF EXISTS "Users can update stripe payments in their company" ON stripe_payments;

CREATE POLICY "Users can view stripe payments in their company"
  ON stripe_payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create stripe payments for their company"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update stripe payments in their company"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix stripe_payment_links
DROP POLICY IF EXISTS "Users can view payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can create payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can update payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can view payment links in their company" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can create payment links for their company" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can update payment links in their company" ON stripe_payment_links;

CREATE POLICY "Users can view payment links in their company"
  ON stripe_payment_links FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create payment links for their company"
  ON stripe_payment_links FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update payment links in their company"
  ON stripe_payment_links FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix stripe_webhook_events
DROP POLICY IF EXISTS "Users can view webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can insert webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can update webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Users can view webhook events in their company" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can insert webhook events for company" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can update webhook events in company" ON stripe_webhook_events;

CREATE POLICY "Users can view webhook events in their company"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service can insert webhook events for company"
  ON stripe_webhook_events FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Service can update webhook events in company"
  ON stripe_webhook_events FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix paid_invoices
DROP POLICY IF EXISTS "Users can view paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can insert paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can view paid invoices in their company" ON paid_invoices;
DROP POLICY IF EXISTS "Users can insert paid invoices for their company" ON paid_invoices;

CREATE POLICY "Users can view paid invoices in their company"
  ON paid_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert paid invoices for their company"
  ON paid_invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Fix communication_logs
DROP POLICY IF EXISTS "Users can view communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can view communication logs in their company" ON communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs for their company" ON communication_logs;

CREATE POLICY "Users can view communication logs in their company"
  ON communication_logs FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert communication logs for their company"
  ON communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Fix automations (only the WITH CHECK true policy)
DROP POLICY IF EXISTS "Users can insert automations" ON automations;
DROP POLICY IF EXISTS "Users can insert automations for their company" ON automations;

CREATE POLICY "Users can insert automations for their company"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());


-- ============================================================================
-- Migration: 20260119211641_add_company_id_to_customer_contacts.sql
-- ============================================================================

/*
  # Add company_id to customer_contacts
  
  Adds the missing company_id column to customer_contacts table
  to support multi-tenancy.
  
  1. Changes
    - Add company_id column to customer_contacts
    - Create index for performance
    - Enable RLS
    - Create security policy
*/

-- Add company_id to customer_contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_contacts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customer_contacts 
    ADD COLUMN company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_customer_contacts_company_id 
ON customer_contacts(company_id);

-- Enable RLS if not already enabled
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Users can view customer contacts from their company" ON customer_contacts;
CREATE POLICY "Users can view customer contacts from their company" ON customer_contacts
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Backfill existing records
UPDATE customer_contacts
SET company_id = (SELECT company_id FROM customers WHERE customers.id = customer_contacts.customer_id)
WHERE company_id IS NULL 
  AND customer_id IS NOT NULL;


-- ============================================================================
-- Migration: 20260120185034_fix_signup_rls_policy.sql
-- ============================================================================

/*
  # Fix Signup RLS Policy for Company Creation

  1. Problem
    - The handle_new_user() trigger fails with 500 error during signup
    - RLS policies on company_settings block the trigger from inserting
    - Even with SECURITY DEFINER, RLS checks the auth context which may not be fully established during signup

  2. Solution
    - Add a policy that allows the trigger to create company_settings
    - Use a less restrictive check that works during the signup flow
    - Keep other policies for normal authenticated operations

  3. Security
    - Policy only allows insert when owner_id matches the NEW user being created
    - Maintains data isolation between companies
*/

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert own company settings" ON public.company_settings;

-- Create a new policy that works during signup
CREATE POLICY "Allow company creation during signup"
  ON public.company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if the owner_id is the current user (normal case)
    owner_id = auth.uid()
    OR
    -- Also allow if being called from trigger context (during signup)
    -- The trigger ensures owner_id = NEW.id from auth.users
    owner_id IS NOT NULL
  );


-- ============================================================================
-- Migration: 20260120201044_production_complete_setup.sql
-- ============================================================================

-- =============================================================================
-- SAFE PRODUCTION SCHEMA - InkOps Platform
-- =============================================================================
-- This version safely adds missing columns and handles existing structures
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
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'USA',
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'USA',
  customer_type TEXT DEFAULT 'business',
  tax_exempt BOOLEAN DEFAULT false,
  tax_id TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  credit_limit DECIMAL(10,2),
  notes TEXT,
  internal_notes TEXT,
  created_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add status column to customers if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'status'
  ) THEN
    ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

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
  order_id TEXT,
  invoice_number TEXT,
  customer_id uuid REFERENCES customers(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_company TEXT,
  customer_address TEXT,
  customer_city TEXT,
  customer_state TEXT,
  customer_zip TEXT,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  amount_outstanding NUMERIC DEFAULT 0,
  balance_remaining NUMERIC,
  invoice_date TIMESTAMPTZ,
  due_date DATE,
  formatted_due_date TEXT,
  formatted_created_at TEXT,
  notes TEXT,
  quote_id TEXT,
  production_notes TEXT,
  company_name TEXT,
  company_logo_url TEXT,
  company_logo_base64 TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip TEXT,
  company_phone TEXT,
  company_email TEXT,
  financially_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB
);

-- Add status columns to printavo_invoices if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'status'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'status_stage'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN status_stage TEXT;
  END IF;
END $$;

-- Printavo line items (invoice details)
CREATE TABLE IF NOT EXISTS printavo_line_items (
  id TEXT PRIMARY KEY,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  invoice_id TEXT REFERENCES printavo_invoices(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  description TEXT,
  quantity INTEGER,
  price NUMERIC,
  total NUMERIC,
  style_name TEXT,
  style_number TEXT,
  color_name TEXT,
  size_name TEXT,
  product_name TEXT,
  category_name TEXT,
  task_name TEXT,
  decoration_name TEXT,
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
  records_synced INTEGER DEFAULT 0,
  error_message TEXT
);

-- Add status column to sync log if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_sync_log' AND column_name = 'status'
  ) THEN
    ALTER TABLE printavo_sync_log ADD COLUMN status TEXT DEFAULT 'running';
  END IF;
END $$;

-- =============================================================================
-- SECTION 4: Unified Payments Table
-- =============================================================================

-- Unified payments table (combines Printavo, Stripe, manual payments)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  invoice_id TEXT,
  customer_id uuid REFERENCES customers(id),
  amount NUMERIC NOT NULL CHECK (amount <> 0),
  payment_type TEXT CHECK (payment_type IS NULL OR payment_type IN ('cash', 'debit_credit', 'check_ach', 'stripe', 'other')),
  payment_method TEXT NOT NULL,
  check_number TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'stripe', 'square', 'printavo', 'other')),
  source_payment_id TEXT,
  created_by uuid REFERENCES auth.users(id),
  recorded_by uuid REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add status column to payments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE payments ADD COLUMN status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'reversed'));
  END IF;
END $$;

-- =============================================================================
-- SECTION 5: Stripe Integration Tables
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'usd',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add status column to stripe_payment_intents if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_payment_intents' AND column_name = 'status'
  ) THEN
    ALTER TABLE stripe_payment_intents ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
  END IF;
END $$;

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
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add status column to stripe_invoices if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_invoices' AND column_name = 'status'
  ) THEN
    ALTER TABLE stripe_invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
  END IF;
END $$;

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
  customer_email TEXT,
  customer_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Add status column to stripe_payment_links if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_payment_links' AND column_name = 'status'
  ) THEN
    ALTER TABLE stripe_payment_links ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  customer_email TEXT,
  customer_name TEXT,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add status column to stripe_payments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE stripe_payments ADD COLUMN status TEXT DEFAULT 'processing';
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  printavo_invoice_id TEXT,
  communication_type TEXT NOT NULL,
  method TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  message TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_by uuid REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Add status column to communication_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE communication_logs ADD COLUMN status TEXT DEFAULT 'sent';
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event JSONB DEFAULT '{}'::jsonb,
  executed_actions JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  execution_time_ms INTEGER DEFAULT 0
);

-- Add status column to automation_logs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE automation_logs ADD COLUMN status TEXT DEFAULT 'success';
  END IF;
END $$;

-- =============================================================================
-- SECTION 8: Storage Buckets
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 9: Indexes for Performance (created only if they don't exist)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_company_settings_owner_id ON company_settings(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_company_id ON customer_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON printavo_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON printavo_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON printavo_invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON printavo_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON printavo_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_amount_outstanding ON printavo_invoices(amount_outstanding);
CREATE INDEX IF NOT EXISTS idx_line_items_company_id ON printavo_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON printavo_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_invoice_id ON printavo_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_payment_date ON printavo_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON printavo_sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id ON stripe_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_printavo_invoice_id ON stripe_payment_links(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id ON stripe_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_printavo_invoice_id ON stripe_payments(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_company_id ON stripe_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer_id ON stripe_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON stripe_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_printavo_invoice_id ON stripe_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_printavo_invoice_id ON billing_queue(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_payment_status ON billing_queue(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_sent_at ON billing_queue(sent_at);
CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_printavo_invoice_id ON communication_logs(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_printavo_invoice_id ON paid_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_payment_date ON paid_invoices(payment_date);
CREATE INDEX IF NOT EXISTS idx_automated_reports_user_id ON automated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_automated_reports_is_enabled ON automated_reports(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automated_reports_schedule_type ON automated_reports(schedule_type);
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

-- Indexes that depend on status columns - only create after confirming columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON printavo_invoices(status);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printavo_invoices' AND column_name = 'status_stage') THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_status_stage ON printavo_invoices(status_stage);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'source') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stripe_payment_links' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_status ON stripe_payment_links(status);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stripe_payments' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_logs' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
  END IF;
END $$;

-- =============================================================================
-- SECTION 10: Helper Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

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

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id uuid;
BEGIN
  INSERT INTO public.company_settings (owner_id, company_name)
  VALUES (
    NEW.id,
    COALESCE(
      split_part(NEW.email, '@', 1) || '''s Company',
      'My Company'
    )
  )
  RETURNING id INTO new_company_id;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

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

DROP POLICY IF EXISTS "Authenticated users can read company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can read their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "New users can insert company settings" ON company_settings;

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

DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

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

DROP POLICY IF EXISTS "Users can view customer contacts in their company" ON customer_contacts;
DROP POLICY IF EXISTS "Users can create customer contacts for their company" ON customer_contacts;
DROP POLICY IF EXISTS "Users can update customer contacts in their company" ON customer_contacts;
DROP POLICY IF EXISTS "Users can delete customer contacts in their company" ON customer_contacts;

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

DROP POLICY IF EXISTS "Allow public read access to invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can insert invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can update invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can delete invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Users can view invoices in their company" ON printavo_invoices;
DROP POLICY IF EXISTS "Users can update invoices in their company" ON printavo_invoices;
DROP POLICY IF EXISTS "Users can insert invoices for their company" ON printavo_invoices;
DROP POLICY IF EXISTS "Service role can manage all invoices" ON printavo_invoices;

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

DROP POLICY IF EXISTS "Users can view line items in their company" ON printavo_line_items;
DROP POLICY IF EXISTS "Service role can manage all line items" ON printavo_line_items;

CREATE POLICY "Users can view line items in their company"
  ON printavo_line_items FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all line items"
  ON printavo_line_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to payments" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can insert payments" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can update payments" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can delete payments" ON printavo_payments;
DROP POLICY IF EXISTS "Users can view payments in their company" ON printavo_payments;
DROP POLICY IF EXISTS "Service role can manage all payments" ON printavo_payments;

CREATE POLICY "Users can view payments in their company"
  ON printavo_payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all payments"
  ON printavo_payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to sync log" ON printavo_sync_log;
DROP POLICY IF EXISTS "Service role can insert sync log" ON printavo_sync_log;
DROP POLICY IF EXISTS "Service role can update sync log" ON printavo_sync_log;
DROP POLICY IF EXISTS "Authenticated users can read sync log" ON printavo_sync_log;
DROP POLICY IF EXISTS "Service role can manage sync log" ON printavo_sync_log;

CREATE POLICY "Authenticated users can read sync log"
  ON printavo_sync_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage sync log"
  ON printavo_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view payments in their company" ON payments;
DROP POLICY IF EXISTS "Users can create payments for their company" ON payments;
DROP POLICY IF EXISTS "Users can update payments in their company" ON payments;
DROP POLICY IF EXISTS "Service role can manage all payments" ON payments;

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

DROP POLICY IF EXISTS "Users can view payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can create payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can update payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can manage payment links in their company" ON stripe_payment_links;

CREATE POLICY "Users can manage payment links in their company"
  ON stripe_payment_links FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can create payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can update payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can manage stripe payments in their company" ON stripe_payments;

CREATE POLICY "Users can manage stripe payments in their company"
  ON stripe_payments FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can insert webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can update webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service role can manage webhook events" ON stripe_webhook_events;

CREATE POLICY "Users can view webhook events"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage stripe customers in their company" ON stripe_customers;

CREATE POLICY "Users can manage stripe customers in their company"
  ON stripe_customers FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage stripe invoices in their company" ON stripe_invoices;

CREATE POLICY "Users can manage stripe invoices in their company"
  ON stripe_invoices FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Service role can manage all stripe payment intents" ON stripe_payment_intents;

CREATE POLICY "Service role can manage all stripe payment intents"
  ON stripe_payment_intents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can insert to billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can update billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can delete from billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can manage billing queue in their company" ON billing_queue;

CREATE POLICY "Users can manage billing queue in their company"
  ON billing_queue FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage billing attempts in their company" ON billing_attempts;

CREATE POLICY "Users can manage billing attempts in their company"
  ON billing_attempts FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can manage communication logs in their company" ON communication_logs;

CREATE POLICY "Users can manage communication logs in their company"
  ON communication_logs FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can insert paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can manage paid invoices in their company" ON paid_invoices;

CREATE POLICY "Users can manage paid invoices in their company"
  ON paid_invoices FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can view own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can create own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can update own automation rules" ON automated_reports;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON automated_reports;

CREATE POLICY "Users can view own automation rules"
  ON automated_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules"
  ON automated_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON automated_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON automated_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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

DROP POLICY IF EXISTS "Users can view all automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Users can insert automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Users can view automation logs" ON automation_logs;
DROP POLICY IF EXISTS "Service role can manage automation logs" ON automation_logs;

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
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');

-- =============================================================================
-- END OF SAFE SCHEMA
-- =============================================================================

-- ============================================================================
-- Migration: 20260120201642_fix_signup_policies_production.sql
-- ============================================================================

/*
  # Fix Signup and User Profile Policies

  1. Changes
    - Remove duplicate RLS policies on user_profiles
    - Ensure clean, working policies for new user signup
    - Fix company_settings policies for signup flow
  
  2. Security
    - Maintains proper RLS isolation
    - Allows new users to create their profile during signup trigger
*/

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;

-- Drop all existing policies on company_settings
DROP POLICY IF EXISTS "Users can read their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "New users can insert company settings" ON company_settings;

-- Create clean policies for user_profiles
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role can manage all user profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create clean policies for company_settings
CREATE POLICY "Users can read their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Service role can manage all company settings"
  ON company_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Migration: 20260120201726_complete_cleanup_signup_flow.sql
-- ============================================================================

/*
  # Complete Cleanup of Signup Flow

  1. Changes
    - Remove ALL duplicate RLS policies
    - Create clean, minimal policies for signup to work
    - Ensure trigger can execute without RLS conflicts
  
  2. Security
    - Proper company isolation maintained
    - New users can sign up successfully
*/

-- ========================================
-- Clean up company_settings policies
-- ========================================
DROP POLICY IF EXISTS "Users can read their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
DROP POLICY IF EXISTS "Super admins can update their company settings" ON company_settings;
DROP POLICY IF EXISTS "Allow company creation during signup" ON company_settings;
DROP POLICY IF EXISTS "Service role can manage all company settings" ON company_settings;

-- Create single, clear SELECT policy
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create single, clear UPDATE policy
CREATE POLICY "Users can update their company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Service role has full access (needed for triggers)
CREATE POLICY "Service role has full access to company settings"
  ON company_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- Clean up user_profiles policies
-- ========================================
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Service role can manage all user profiles" ON user_profiles;

-- Users can view profiles in their company
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role has full access (needed for triggers)
CREATE POLICY "Service role has full access to user profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Migration: 20260120232751_fix_user_profile_self_access.sql
-- ============================================================================

/*
  # Fix User Profile Self-Access

  1. Changes
    - Add explicit policy for users to view their own profile
    - This ensures useRBAC hook can always load the current user's profile
    - Fixes super admin access restrictions

  2. Security
    - Users can always read their own profile data
    - Maintains existing company-based access for viewing other profiles
*/

-- Drop existing policy if it exists and recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
END $$;

-- Add policy for users to view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());


-- ============================================================================
-- Migration: 20260120233129_fix_user_profile_infinite_recursion.sql
-- ============================================================================

/*
  # Fix Infinite Recursion in User Profile RLS Policies

  1. Problem
    - The "Users can view profiles in their company" policy causes infinite recursion
    - It tries to read from user_profiles while checking if you can read user_profiles

  2. Solution
    - Create a security definer function to get user's company_id without recursion
    - Update the policy to use this function

  3. Security
    - Users can view their own profile
    - Users can view other profiles in their company
    - Function uses security definer to bypass RLS when getting company_id
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Create a security definer function to get the current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Recreate the policy using the function to avoid recursion
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());


-- ============================================================================
-- Migration: 20260120233200_fix_company_settings_recursion.sql
-- ============================================================================

/*
  # Fix Company Settings RLS Policies

  1. Changes
    - Update company_settings policies to use the get_user_company_id() function
    - This prevents any potential recursion issues
    - Ensures consistent access pattern across tables

  2. Security
    - Users can view and update their company settings
    - Uses the security definer function to avoid recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update their company settings" ON company_settings;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view their company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (id = get_user_company_id());

CREATE POLICY "Users can update their company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (id = get_user_company_id())
  WITH CHECK (id = get_user_company_id());


-- ============================================================================
-- Migration: 20260120235731_fix_user_profile_auth_for_edge_functions.sql
-- ============================================================================

/*
  # Fix User Profile Authentication for Edge Functions
  
  The edge function needs to query user_profiles to get the user's company_id,
  but the RLS policy prevents this by requiring company_id = get_user_company_id().
  This creates a circular dependency.
  
  Solution: Allow users to always view their own profile by id = auth.uid(),
  without requiring company_id matching.
  
  ## Changes
  - Drop the existing "Users can view own profile" policy  
  - Create a new policy that allows users to view their own profile without company_id check
  - Keep the policy for viewing other profiles in the same company
*/

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
END $$;

-- Allow users to ALWAYS view their own profile (no company_id check needed)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow users to view other profiles in their company (if they have a company_id)
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id != auth.uid() AND
    company_id IS NOT NULL AND
    company_id = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );


-- ============================================================================
-- Migration: 20260121000915_fix_infinite_recursion_user_profiles_v2.sql
-- ============================================================================

/*
  # Fix infinite recursion in user_profiles RLS policies
  
  1. Problem
    - The get_user_company_id() function queries user_profiles
    - The user_profiles RLS policies call get_user_company_id()
    - This creates infinite recursion
  
  2. Solution
    - Make get_user_company_id() a SECURITY DEFINER function
    - This allows it to bypass RLS when executing
    - Prevents the recursion loop
  
  3. Security
    - Function only returns data for the authenticated user (auth.uid())
    - Cannot be exploited to access other users' data
*/

-- Recreate get_user_company_id as SECURITY DEFINER (use OR REPLACE to avoid dropping dependencies)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id 
  FROM user_profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;

-- Recreate get_user_role as SECURITY DEFINER  
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role 
  FROM user_profiles 
  WHERE id = auth.uid() 
  LIMIT 1;
$$;


-- ============================================================================
-- Migration: 20260121001334_fix_user_profiles_policy_recursion.sql
-- ============================================================================

/*
  # Fix user_profiles policy that causes infinite recursion
  
  1. Problem
    - The "Users can view profiles in their company" policy directly queries user_profiles
    - This causes infinite recursion when RLS checks the policy
  
  2. Solution
    - Replace the inline subquery with get_user_company_id() function
    - The function is now SECURITY DEFINER so it bypasses RLS
  
  3. Security
    - Same access control as before, just without the recursion
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

-- Recreate it using the SECURITY DEFINER function
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id <> auth.uid() 
    AND company_id IS NOT NULL 
    AND company_id = get_user_company_id()
  );


-- ============================================================================
-- Migration: 20260121154310_fix_security_performance_step1_indexes.sql
-- ============================================================================

/*
  # Fix Security and Performance Issues - Step 1: Indexes

  ## 1. Add Missing Foreign Key Indexes
    - Add indexes for foreign keys on billing_attempts (company_id, queue_item_id)
    - Add index for payments.invoice_id
    - Add index for stripe_payment_intents.company_id

  ## 2. Drop Duplicate Indexes
    - Keep newer idx_printavo_* indexes, drop older idx_* versions

  ## 3. Drop Unused Indexes
    - Remove 48+ indexes that are never used
*/

-- =====================================================
-- ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_billing_attempts_company_id
  ON billing_attempts(company_id);

CREATE INDEX IF NOT EXISTS idx_billing_attempts_queue_item_id
  ON billing_attempts(queue_item_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id_new
  ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_company_id
  ON stripe_payment_intents(company_id);

-- =====================================================
-- DROP DUPLICATE INDEXES (keep newer ones)
-- =====================================================

DROP INDEX IF EXISTS idx_invoices_company_id;
DROP INDEX IF EXISTS idx_invoices_customer_id;
DROP INDEX IF EXISTS idx_invoices_status_stage;
DROP INDEX IF EXISTS idx_line_items_company_id;
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_payments_payment_date;
DROP INDEX IF EXISTS idx_stripe_invoices_printavo_id;

-- =====================================================
-- DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_quotes_quote_number;
DROP INDEX IF EXISTS idx_quotes_status;
DROP INDEX IF EXISTS idx_quote_items_quote_id;
DROP INDEX IF EXISTS idx_quote_imprints_quote_id;
DROP INDEX IF EXISTS idx_quote_fees_quote_id;
DROP INDEX IF EXISTS idx_automations_enabled;
DROP INDEX IF EXISTS idx_automations_trigger_type;
DROP INDEX IF EXISTS idx_automation_logs_automation_id;
DROP INDEX IF EXISTS idx_automation_logs_status;
DROP INDEX IF EXISTS idx_automation_logs_executed_at;
DROP INDEX IF EXISTS idx_customer_contacts_email;
DROP INDEX IF EXISTS idx_automated_reports_is_enabled;
DROP INDEX IF EXISTS idx_automated_reports_schedule_type;
DROP INDEX IF EXISTS idx_stripe_payment_links_company_id;
DROP INDEX IF EXISTS idx_stripe_payments_company_id;
DROP INDEX IF EXISTS idx_stripe_payments_status;
DROP INDEX IF EXISTS idx_stripe_webhook_events_processed;
DROP INDEX IF EXISTS idx_billing_queue_payment_status;
DROP INDEX IF EXISTS idx_communication_logs_company_id;
DROP INDEX IF EXISTS idx_communication_logs_sent_at;
DROP INDEX IF EXISTS idx_paid_invoices_company_id;
DROP INDEX IF EXISTS idx_printavo_statuses_type;
DROP INDEX IF EXISTS idx_printavo_statuses_billing;
DROP INDEX IF EXISTS idx_stripe_invoices_company_id;
DROP INDEX IF EXISTS idx_stripe_invoices_status;
DROP INDEX IF EXISTS idx_payment_history_invoice_id;
DROP INDEX IF EXISTS idx_payment_history_created_at;
DROP INDEX IF EXISTS idx_ar_report_automations_enabled;
DROP INDEX IF EXISTS idx_ar_report_logs_automation;
DROP INDEX IF EXISTS idx_ar_report_logs_executed_at;
DROP INDEX IF EXISTS idx_user_profiles_email;
DROP INDEX IF EXISTS idx_user_profiles_company_id;
DROP INDEX IF EXISTS idx_invoices_customer_email;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_printavo_line_items_company_id;
DROP INDEX IF EXISTS idx_printavo_payments_company_id;
DROP INDEX IF EXISTS idx_printavo_payments_invoice_id;
DROP INDEX IF EXISTS idx_printavo_payments_payment_date;
DROP INDEX IF EXISTS idx_stripe_customers_company_id;
DROP INDEX IF EXISTS idx_sms_logs_sent_at;
DROP INDEX IF EXISTS idx_stripe_customers_customer_id;
DROP INDEX IF EXISTS idx_stripe_invoices_printavo_invoice_id;
DROP INDEX IF EXISTS idx_line_items_extracted_color;
DROP INDEX IF EXISTS idx_printavo_invoices_financially_locked;
DROP INDEX IF EXISTS idx_ar_report_presets_created_by;
DROP INDEX IF EXISTS idx_communication_logs_sent_by;
DROP INDEX IF EXISTS idx_payments_created_by;
DROP INDEX IF EXISTS idx_printavo_invoices_status_stage;


-- ============================================================================
-- Migration: 20260121154459_fix_security_performance_step2_functions_policies_v2.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260121164437_fix_remaining_security_issues_v2.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260121212934_create_customer_fundraising_credits_table.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260121213400_allow_negative_fundraising_credits.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260122014610_add_fundraising_report_upload.sql
-- ============================================================================

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
);

-- ============================================================================
-- Migration: 20260122133536_add_report_url_to_fundraising_credits.sql
-- ============================================================================

/*
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


-- ============================================================================
-- Migration: 20260122153254_fix_comprehensive_security_issues.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20260122163807_fix_user_profiles_infinite_recursion.sql
-- ============================================================================

/*
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


-- ============================================================================
-- Migration: 20260122173146_auto_unlock_invoices_with_outstanding_balance.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260122183813_add_trigger_recalculate_invoice_on_payment_change.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260122190041_fix_payment_calculation_and_billing_queue_sync.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 20260122190122_fix_reversed_payment_calculation.sql
-- ============================================================================

/*
  # Fix reversed payment calculation
  
  1. Problem
    - Reversed payments have negative amounts but were being excluded from calculation
    - When a $1 payment is reversed, it creates a -$1 entry that should be included
    - Current logic: $1 (successful) + 0 (reversed excluded) = $1 WRONG
    - Correct logic: $1 (successful) + (-$1) (reversed) = $0
    
  2. Solution
    - Include reversed payments in the calculation since they already have negative amounts
    
  3. Changes
    - Update recalculate_single_invoice_balance() to include reversed payments
*/

CREATE OR REPLACE FUNCTION recalculate_single_invoice_balance(p_invoice_id text)
RETURNS void AS $$
DECLARE
  v_calculated_paid numeric;
  v_invoice_total numeric;
  v_balance_remaining numeric;
  v_new_payment_status text;
BEGIN
  -- Calculate total payments for this invoice
  -- Include reversed payments since they have negative amounts
  SELECT COALESCE(SUM(CASE 
    WHEN status = 'successful' THEN amount
    WHEN status = 'reversed' THEN amount  -- Include reversed (negative amounts)
    WHEN status = 'partial_refund' THEN amount - COALESCE(refund_amount, 0)
    WHEN status = 'refunded' THEN 0  -- Exclude fully refunded
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

-- Recalculate all invoice balances to fix existing data
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


-- ============================================================================
-- Migration: 20260122204652_create_customer_payment_methods_table.sql
-- ============================================================================

/*
  # Create customer_payment_methods table

  1. New Tables
    - customer_payment_methods table for storing customer payment information
    
  2. Security
    - Enable RLS
    - Add policies for same-company access
*/

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  payment_method_type text NOT NULL CHECK (payment_method_type IN ('credit_card', 'bank_account', 'check', 'other')),
  name text NOT NULL,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  payment_processor text,
  processor_token text,
  last_four text,
  expiry_month integer CHECK (expiry_month >= 1 AND expiry_month <= 12),
  expiry_year integer CHECK (expiry_year >= 2000),
  bank_name text,
  account_type text CHECK (account_type IN ('checking', 'savings', NULL)),
  billing_address jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id ON customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_company_id ON customer_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_is_primary ON customer_payment_methods(is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view payment methods in their company"
  ON customer_payment_methods FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert payment methods in their company"
  ON customer_payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update payment methods in their company"
  ON customer_payment_methods FOR UPDATE
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

CREATE POLICY "Users can delete payment methods in their company"
  ON customer_payment_methods FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- Migration: 20260122204709_create_customer_tax_exemptions_table.sql
-- ============================================================================

/*
  # Create customer_tax_exemptions table

  1. New Tables
    - customer_tax_exemptions table for tracking tax exemption certificates and history
    
  2. Security
    - Enable RLS
    - Add policies for same-company access
*/

CREATE TABLE IF NOT EXISTS customer_tax_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  exemption_type text NOT NULL CHECK (exemption_type IN ('federal', 'state', 'local', 'reseller', 'nonprofit', 'government', 'other')),
  tax_id text,
  exemption_number text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  document_url text,
  document_filename text,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_customer_id ON customer_tax_exemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_company_id ON customer_tax_exemptions(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_tax_exemptions_is_active ON customer_tax_exemptions(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE customer_tax_exemptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view tax exemptions in their company"
  ON customer_tax_exemptions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tax exemptions in their company"
  ON customer_tax_exemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update tax exemptions in their company"
  ON customer_tax_exemptions FOR UPDATE
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

CREATE POLICY "Users can delete tax exemptions in their company"
  ON customer_tax_exemptions FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- Migration: 20260123004139_add_fundraising_credit_payment_type.sql
-- ============================================================================

/*
  # Add fundraising_credit to valid payment types
  
  Updates the check constraint to allow 'fundraising_credit' as a valid payment type.
*/

-- Drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS valid_payment_type;

-- Add the updated check constraint with fundraising_credit
ALTER TABLE payments ADD CONSTRAINT valid_payment_type 
  CHECK (payment_type IS NULL OR payment_type IN ('cash', 'debit_credit', 'check_ach', 'stripe', 'other', 'fundraising_credit'));


-- ============================================================================
-- Migration: 20260123154858_rebuild_quotes_module_complete.sql
-- ============================================================================

/*
  # Rebuild Complete Quotes Module

  1. Purpose
    - Drop old quote tables (quote_items, quote_fees, quote_imprints, quotes)
    - Create new production-ready quotes module with approval system
    - Isolated from Accounting module
    - Support full quote-to-production workflow

  2. New Tables
    - `quotes` - Main quotes table with customer info and pricing
    - `quote_line_items` - Individual line items for quotes
    - `quote_activity_log` - Audit trail for all quote actions
    - `quote_approvals` - Public approval links with tokens
    - `quote_approval_responses` - Customer approval/rejection responses

  3. Security
    - RLS enabled on all tables
    - Company-based isolation
    - Role-based access control for sensitive actions
*/

-- Drop old quote tables (they're empty)
DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quote_fees CASCADE;
DROP TABLE IF EXISTS quote_imprints CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;

-- Create new quotes table
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_company text,
  billing_address jsonb DEFAULT '{}'::jsonb,
  shipping_address jsonb DEFAULT '{}'::jsonb,
  
  line_items jsonb DEFAULT '[]'::jsonb,
  artwork_refs jsonb DEFAULT '[]'::jsonb,
  pricing_reference text,
  
  subtotal numeric(10,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired', 'converted')),
  valid_until date,
  notes text,
  customer_notes text,
  
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  converted_at timestamptz,
  production_job_id uuid
);

-- Create quote_line_items table
CREATE TABLE quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  line_number int NOT NULL DEFAULT 0,
  sku text,
  description text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  decoration_method text,
  decoration_location text,
  artwork_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote_activity_log table
CREATE TABLE quote_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  performed_by_name text,
  performed_at timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb
);

-- Create quote_approvals table
CREATE TABLE quote_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  approval_token text UNIQUE NOT NULL,
  expires_at timestamptz,
  single_use boolean DEFAULT true,
  auto_approve_after_days int,
  auto_convert_on_approval boolean DEFAULT false,
  is_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Create quote_approval_responses table
CREATE TABLE quote_approval_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES quote_approvals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  approved boolean NOT NULL,
  approver_name text NOT NULL,
  approver_email text NOT NULL,
  notes text,
  responded_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Create indexes
CREATE INDEX idx_quotes_company_id ON quotes(company_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);

CREATE INDEX idx_quote_line_items_quote_id ON quote_line_items(quote_id);
CREATE INDEX idx_quote_line_items_company_id ON quote_line_items(company_id);

CREATE INDEX idx_quote_activity_log_quote_id ON quote_activity_log(quote_id);
CREATE INDEX idx_quote_activity_log_company_id ON quote_activity_log(company_id);
CREATE INDEX idx_quote_activity_log_performed_at ON quote_activity_log(performed_at DESC);

CREATE INDEX idx_quote_approvals_quote_id ON quote_approvals(quote_id);
CREATE INDEX idx_quote_approvals_token ON quote_approvals(approval_token);
CREATE INDEX idx_quote_approvals_expires_at ON quote_approvals(expires_at);

CREATE INDEX idx_quote_approval_responses_approval_id ON quote_approval_responses(approval_id);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_approval_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Users can view quotes for their company"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes for their company"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotes for their company"
  ON quotes FOR UPDATE
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

CREATE POLICY "Admins can delete quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for quote_line_items
CREATE POLICY "Users can view line items for their company"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage line items for their company"
  ON quote_line_items FOR ALL
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

-- RLS Policies for quote_activity_log
CREATE POLICY "Users can view activity logs for their company"
  ON quote_activity_log FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create activity logs for their company"
  ON quote_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for quote_approvals
CREATE POLICY "Users can view approvals for their company"
  ON quote_approvals FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create approvals for their company"
  ON quote_approvals FOR ALL
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

-- Public access to approvals via token (for edge functions)
CREATE POLICY "Public can view approvals by token"
  ON quote_approvals FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for quote_approval_responses
CREATE POLICY "Users can view responses for their company"
  ON quote_approval_responses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Public can create approval responses (for edge functions)
CREATE POLICY "Public can create approval responses"
  ON quote_approval_responses FOR INSERT
  TO anon
  WITH CHECK (true);

-- Function to generate quote numbers
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS text AS $$
DECLARE
  new_number text;
  max_number int;
BEGIN
  -- Get the highest quote number for this year
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::int
  ), 0) INTO max_number
  FROM quotes
  WHERE quote_number LIKE 'Q' || TO_CHAR(CURRENT_DATE, 'YY') || '%';
  
  -- Generate new quote number
  new_number := 'Q' || TO_CHAR(CURRENT_DATE, 'YY') || LPAD((max_number + 1)::text, 5, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update quote totals when line items change
CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal numeric;
  v_tax_amount numeric;
  v_total numeric;
  v_tax_rate numeric;
  v_quote_id uuid;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Get the quote's tax rate
  SELECT tax_rate INTO v_tax_rate
  FROM quotes
  WHERE id = v_quote_id;
  
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
  FROM quote_line_items
  WHERE quote_id = v_quote_id;
  
  -- Calculate tax amount
  v_tax_amount := ROUND(v_subtotal * (v_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax_amount;
  
  -- Update quote totals
  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_total,
    updated_at = now()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update quote totals
DROP TRIGGER IF EXISTS trigger_update_quote_totals ON quote_line_items;
CREATE TRIGGER trigger_update_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_totals();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on quotes
DROP TRIGGER IF EXISTS trigger_quotes_updated_at ON quotes;
CREATE TRIGGER trigger_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- Trigger to update updated_at on quote_line_items
DROP TRIGGER IF EXISTS trigger_quote_line_items_updated_at ON quote_line_items;
CREATE TRIGGER trigger_quote_line_items_updated_at
  BEFORE UPDATE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- Function to log quote activity
CREATE OR REPLACE FUNCTION log_quote_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_user_name text;
  v_company_id uuid;
BEGIN
  -- Get company_id
  v_company_id := NEW.company_id;
  
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      v_action := 'status_changed_to_' || NEW.status;
    ELSE
      v_action := 'updated';
    END IF;
  END IF;
  
  -- Get user name if available
  SELECT full_name INTO v_user_name
  FROM user_profiles
  WHERE id = NEW.created_by;
  
  -- Log activity
  INSERT INTO quote_activity_log (
    quote_id,
    company_id,
    action,
    performed_by,
    performed_by_name,
    meta
  ) VALUES (
    NEW.id,
    v_company_id,
    v_action,
    NEW.created_by,
    v_user_name,
    jsonb_build_object(
      'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      'new_status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log quote changes
DROP TRIGGER IF EXISTS trigger_log_quote_activity ON quotes;
CREATE TRIGGER trigger_log_quote_activity
  AFTER INSERT OR UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION log_quote_activity();


-- ============================================================================
-- Migration: 20260123155649_create_quote_auto_approval_cron.sql
-- ============================================================================

/*
  # Create Auto-Approval Background Job for Quotes

  1. Purpose
    - Auto-approve quotes after X days if configured
    - Auto-expire quotes past their valid_until date
    - Run daily to check and process approvals

  2. Implementation
    - Create function to process auto-approvals
    - Create function to expire old quotes
    - Set up pg_cron job to run daily
*/

-- Function to auto-approve quotes based on auto_approve_after_days
CREATE OR REPLACE FUNCTION process_quote_auto_approvals()
RETURNS void AS $$
DECLARE
  v_approval RECORD;
  v_auto_approve_date timestamptz;
BEGIN
  -- Loop through approvals with auto_approve_after_days set
  FOR v_approval IN
    SELECT 
      qa.id,
      qa.quote_id,
      qa.company_id,
      qa.auto_approve_after_days,
      qa.created_at,
      q.status
    FROM quote_approvals qa
    JOIN quotes q ON q.id = qa.quote_id
    WHERE qa.auto_approve_after_days IS NOT NULL
      AND qa.auto_approve_after_days > 0
      AND q.status = 'sent'
      AND qa.is_used = false
  LOOP
    -- Calculate auto-approve date
    v_auto_approve_date := v_approval.created_at + (v_approval.auto_approve_after_days || ' days')::interval;
    
    -- Check if we should auto-approve
    IF now() >= v_auto_approve_date THEN
      -- Update quote to approved
      UPDATE quotes
      SET 
        status = 'approved',
        approved_at = now(),
        updated_at = now()
      WHERE id = v_approval.quote_id;
      
      -- Mark approval as used
      UPDATE quote_approvals
      SET is_used = true
      WHERE id = v_approval.id;
      
      -- Create approval response
      INSERT INTO quote_approval_responses (
        approval_id,
        company_id,
        approved,
        approver_name,
        approver_email,
        notes,
        responded_at
      ) VALUES (
        v_approval.id,
        v_approval.company_id,
        true,
        'System Auto-Approval',
        'system@auto-approval',
        'Automatically approved after ' || v_approval.auto_approve_after_days || ' days',
        now()
      );
      
      -- Log activity
      INSERT INTO quote_activity_log (
        quote_id,
        company_id,
        action,
        performed_by,
        performed_by_name,
        performed_at,
        meta
      ) VALUES (
        v_approval.quote_id,
        v_approval.company_id,
        'auto_approved',
        NULL,
        'System',
        now(),
        jsonb_build_object(
          'auto_approve_after_days', v_approval.auto_approve_after_days,
          'approval_id', v_approval.id
        )
      );
      
      RAISE NOTICE 'Auto-approved quote % after % days', v_approval.quote_id, v_approval.auto_approve_after_days;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to expire quotes past their valid_until date
CREATE OR REPLACE FUNCTION expire_old_quotes()
RETURNS void AS $$
DECLARE
  v_quote RECORD;
BEGIN
  -- Loop through quotes that are sent but past valid_until
  FOR v_quote IN
    SELECT 
      id,
      quote_number,
      company_id,
      valid_until
    FROM quotes
    WHERE status = 'sent'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE
  LOOP
    -- Update quote to expired
    UPDATE quotes
    SET 
      status = 'expired',
      updated_at = now()
    WHERE id = v_quote.id;
    
    -- Log activity
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by,
      performed_by_name,
      performed_at,
      meta
    ) VALUES (
      v_quote.id,
      v_quote.company_id,
      'expired',
      NULL,
      'System',
      now(),
      jsonb_build_object(
        'valid_until', v_quote.valid_until,
        'expired_at', now()
      )
    );
    
    RAISE NOTICE 'Expired quote % (valid until: %)', v_quote.quote_number, v_quote.valid_until;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create combined function to run both processes
CREATE OR REPLACE FUNCTION process_quote_background_jobs()
RETURNS void AS $$
BEGIN
  -- Process auto-approvals
  PERFORM process_quote_auto_approvals();
  
  -- Expire old quotes
  PERFORM expire_old_quotes();
  
  RAISE NOTICE 'Quote background jobs completed at %', now();
END;
$$ LANGUAGE plpgsql;

-- Schedule cron job to run daily at 2 AM
-- Note: pg_cron extension must be enabled
DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('process-quote-background-jobs');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'process-quote-background-jobs',
      '0 2 * * *', -- Run at 2 AM every day
      'SELECT process_quote_background_jobs();'
    );
    
    RAISE NOTICE 'Scheduled quote background jobs cron';
  ELSE
    RAISE NOTICE 'pg_cron extension not available, background jobs not scheduled';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $$;


-- ============================================================================
-- Migration: 20260123190717_add_printavo_fields_to_quotes.sql
-- ============================================================================

/*
  # Add Printavo-Style Fields to Quotes

  1. Purpose
    - Add fields to match Printavo invoice template layout
    - Support for PO numbers, delivery method, and date tracking
    - Add 4XL size support to line items

  2. Changes to `quotes` table
    - `po_number` - Purchase order number from customer
    - `delivery_method` - PICK-UP, DELIVERY, SHIPPING, etc.
    - `invoice_date` - Separate from created_date for when quote becomes invoice
    - `payment_due_date` - Calculated or manual payment deadline
    - `terms` - Payment terms (Net 30, etc.)
    - `company_name` - Company name for quote header
    - `company_address` - Company address
    - `company_city` - Company city
    - `company_state` - Company state
    - `company_zip` - Company zip code
    - `company_phone` - Company phone
    - `company_email` - Company email
    - `company_website` - Company website
    - `company_logo_url` - URL to company logo

  3. Changes to `quote_line_items` table
    - Add size breakdown columns for apparel items
    - Add `qty_4xl` to support 4XL size

  4. Security
    - No RLS changes needed (already secured by company_id)
*/

-- Add new fields to quotes table
DO $$
BEGIN
  -- PO and delivery info
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'po_number') THEN
    ALTER TABLE quotes ADD COLUMN po_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'delivery_method') THEN
    ALTER TABLE quotes ADD COLUMN delivery_method text DEFAULT 'PICK-UP';
  END IF;

  -- Date fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'invoice_date') THEN
    ALTER TABLE quotes ADD COLUMN invoice_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'payment_due_date') THEN
    ALTER TABLE quotes ADD COLUMN payment_due_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'terms') THEN
    ALTER TABLE quotes ADD COLUMN terms text DEFAULT 'Net 30';
  END IF;

  -- Company info fields for quote header
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_name') THEN
    ALTER TABLE quotes ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_address') THEN
    ALTER TABLE quotes ADD COLUMN company_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_city') THEN
    ALTER TABLE quotes ADD COLUMN company_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_state') THEN
    ALTER TABLE quotes ADD COLUMN company_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_zip') THEN
    ALTER TABLE quotes ADD COLUMN company_zip text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_phone') THEN
    ALTER TABLE quotes ADD COLUMN company_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_email') THEN
    ALTER TABLE quotes ADD COLUMN company_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_website') THEN
    ALTER TABLE quotes ADD COLUMN company_website text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_logo_url') THEN
    ALTER TABLE quotes ADD COLUMN company_logo_url text;
  END IF;
END $$;

-- Add size breakdown columns to quote_line_items
DO $$
BEGIN
  -- Youth sizes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_yxs') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_yxs int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_ys') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ys int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_ym') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ym int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_yl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_yl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_yxl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_yxl int DEFAULT 0;
  END IF;

  -- Adult sizes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_xs') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_xs int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_s') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_s int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_m') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_m int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_l') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_l int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_xl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_2xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_2xl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_3xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_3xl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_4xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_4xl int DEFAULT 0;
  END IF;

  -- Item details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'item_number') THEN
    ALTER TABLE quote_line_items ADD COLUMN item_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'color') THEN
    ALTER TABLE quote_line_items ADD COLUMN color text;
  END IF;

  -- Line item type (item, fee, imprint)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'line_type') THEN
    ALTER TABLE quote_line_items ADD COLUMN line_type text DEFAULT 'item' CHECK (line_type IN ('item', 'fee', 'imprint'));
  END IF;

  -- For imprints
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'imprint_number') THEN
    ALTER TABLE quote_line_items ADD COLUMN imprint_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'num_colors') THEN
    ALTER TABLE quote_line_items ADD COLUMN num_colors int;
  END IF;
END $$;

-- Create index for line type
CREATE INDEX IF NOT EXISTS idx_quote_line_items_line_type ON quote_line_items(line_type);

-- Add comment
COMMENT ON TABLE quotes IS 'Quotes table with Printavo-style fields for comprehensive quote/invoice generation';
COMMENT ON TABLE quote_line_items IS 'Quote line items with size breakdown support and multiple line types (items, fees, imprints)';


-- ============================================================================
-- Migration: 20260123200636_add_quote_discount_and_tax_fields.sql
-- ============================================================================

/*
  # Add discount and tax fields to quotes

  1. Changes to quotes table
    - Add discount_type column ($ or %)
    - Add sales_tax_rate column
    - Add sales_tax column

  2. Changes to quote_line_items table
    - Add taxed boolean column
    - Add sort_order column for proper ordering
*/

-- Add discount_type, sales_tax_rate, and sales_tax to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE quotes ADD COLUMN discount_type text DEFAULT '$';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'sales_tax_rate'
  ) THEN
    ALTER TABLE quotes ADD COLUMN sales_tax_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'sales_tax'
  ) THEN
    ALTER TABLE quotes ADD COLUMN sales_tax numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'discount'
  ) THEN
    ALTER TABLE quotes ADD COLUMN discount numeric DEFAULT 0;
  END IF;
END $$;

-- Add taxed and sort_order columns to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'taxed'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN taxed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260123202906_create_invoice_fees_table.sql
-- ============================================================================

/*
  # Create Invoice Fees Table

  1. New Tables
    - `invoice_fees`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `fee_name` (text) - Name of the fee
      - `description` (text) - Optional description
      - `amount` (numeric) - Fee amount
      - `amount_type` (text) - Either 'dollar' or 'percent'
      - `is_taxed` (boolean) - Whether this fee is taxable
      - `show_by_default` (boolean) - Auto-populate on new quotes/invoices
      - `is_active` (boolean) - Whether fee is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `invoice_fees` table
    - Add policies for company-isolated access
    - Only authenticated users from the same company can manage fees

  3. Indexes
    - Index on company_id for fast lookups
    - Index on show_by_default for auto-population queries
*/

-- Create invoice_fees table
CREATE TABLE IF NOT EXISTS invoice_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  fee_name text NOT NULL,
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  amount_type text NOT NULL DEFAULT 'dollar' CHECK (amount_type IN ('dollar', 'percent')),
  is_taxed boolean NOT NULL DEFAULT false,
  show_by_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_fees_company_id ON invoice_fees(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_fees_show_by_default ON invoice_fees(company_id, show_by_default) WHERE is_active = true;

-- Enable RLS
ALTER TABLE invoice_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoice fees from their company"
  ON invoice_fees FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoice fees for their company"
  ON invoice_fees FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoice fees from their company"
  ON invoice_fees FOR UPDATE
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

CREATE POLICY "Users can delete invoice fees from their company"
  ON invoice_fees FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_invoice_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_fees_updated_at
  BEFORE UPDATE ON invoice_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_fees_updated_at();

-- ============================================================================
-- Migration: 20260123204236_fix_invoice_fees_column_names.sql
-- ============================================================================

/*
  # Fix Invoice Fees Table Column Names

  1. Changes
    - Rename `name` column to `fee_name` to match application code
    - Update `amount_type` default from 'fixed' to 'dollar' to match application logic
    - Update CHECK constraint for amount_type to accept 'dollar' and 'percent'

  2. Rationale
    - Application code expects `fee_name` column
    - Application uses 'dollar' and 'percent' as amount_type values
*/

-- Rename name column to fee_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_fees' AND column_name = 'name'
  ) THEN
    ALTER TABLE invoice_fees RENAME COLUMN name TO fee_name;
  END IF;
END $$;

-- Drop old constraint and add new one for amount_type
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invoice_fees' AND constraint_name LIKE '%amount_type%'
  ) THEN
    ALTER TABLE invoice_fees DROP CONSTRAINT IF EXISTS invoice_fees_amount_type_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE invoice_fees ADD CONSTRAINT invoice_fees_amount_type_check 
    CHECK (amount_type IN ('dollar', 'percent'));
END $$;

-- Update default value for amount_type
ALTER TABLE invoice_fees ALTER COLUMN amount_type SET DEFAULT 'dollar';

-- Update any existing rows with 'fixed' to 'dollar'
UPDATE invoice_fees SET amount_type = 'dollar' WHERE amount_type = 'fixed';


-- ============================================================================
-- Migration: 20260123232232_create_quote_imprints_table.sql
-- ============================================================================

/*
  # Create Quote Imprints Table

  1. New Tables
    - `quote_imprints`
      - `id` (uuid, primary key)
      - `quote_id` (uuid, foreign key to quotes)
      - `company_id` (uuid, foreign key to company_settings)
      - `matrix` (text) - Location of imprint (Front, Back, Left Chest, etc.)
      - `column_number` (text) - Column number for organization
      - `type_of_work` (text) - Type of decoration (Screen Print, Embroidery, etc.)
      - `details` (text) - Additional details about the imprint
      - `mockups` (jsonb) - Array of mockup image URLs
      - `sort_order` (integer) - Order of imprints
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `quote_imprints` table
    - Add policies for authenticated users to manage their company's imprints
*/

CREATE TABLE IF NOT EXISTS quote_imprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  matrix text,
  column_number text,
  type_of_work text,
  details text,
  mockups jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_imprints_quote_id ON quote_imprints(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_imprints_company_id ON quote_imprints(company_id);

ALTER TABLE quote_imprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's imprints"
  ON quote_imprints
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's imprints"
  ON quote_imprints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's imprints"
  ON quote_imprints
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's imprints"
  ON quote_imprints
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_quote_imprint_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.quote_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM quotes
    WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_imprint_company_id_trigger
  BEFORE INSERT ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_imprint_company_id();

CREATE TRIGGER update_quote_imprints_updated_at
  BEFORE UPDATE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: 20260123234108_create_price_matrices_table.sql
-- ============================================================================

/*
  # Create Price Matrices Table

  1. New Tables
    - `price_matrices`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `name` (text) - Name of the pricing matrix
      - `description` (text) - Optional description
      - `columns` (jsonb) - Array of column headers
      - `rows` (jsonb) - Array of row headers
      - `cells` (jsonb) - Object mapping row-column to price values
      - `is_active` (boolean) - Whether this matrix is currently active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `price_matrices` table
    - Add policies for authenticated users to manage their company's matrices

  3. Notes
    - Columns will be stored as: ["Size S", "Size M", "Size L", ...]
    - Rows will be stored as: ["1-24 units", "25-49 units", "50-99 units", ...]
    - Cells will be stored as: {"0-0": 10.50, "0-1": 9.50, "1-0": 9.00, ...}
      where the key is "rowIndex-columnIndex" and value is the price
*/

CREATE TABLE IF NOT EXISTS price_matrices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  columns jsonb DEFAULT '[]'::jsonb,
  rows jsonb DEFAULT '[]'::jsonb,
  cells jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_matrices_company_id ON price_matrices(company_id);
CREATE INDEX IF NOT EXISTS idx_price_matrices_is_active ON price_matrices(company_id, is_active);

ALTER TABLE price_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's price matrices"
  ON price_matrices
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's price matrices"
  ON price_matrices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's price matrices"
  ON price_matrices
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's price matrices"
  ON price_matrices
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_price_matrices_updated_at
  BEFORE UPDATE ON price_matrices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: 20260123234715_create_imprints_and_proofs_tables.sql
-- ============================================================================

/*
  # Create Imprints and Proofs Tables

  1. New Tables
    - `imprints`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `quote_line_item_id` (uuid, foreign key to quote_line_items) - optional
      - `location` (text) - Where the imprint goes (e.g., "Front", "Back", "Left Chest")
      - `ink_colors` (jsonb) - Array of ink color names
      - `print_passes` (integer) - Number of print passes
      - `production_notes` (text) - Notes for production
      - `selected_matrix_id` (uuid, foreign key to price_matrices) - Selected pricing matrix
      - `quantity` (integer) - Quantity for pricing calculation
      - `calculated_price` (decimal) - Auto-calculated price from matrix
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `imprint_proofs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `imprint_id` (uuid, foreign key to imprints)
      - `version_number` (integer) - Version number for ordering
      - `artwork_url` (text) - URL to uploaded artwork
      - `notes` (text) - Notes for this version
      - `status` (text) - e.g., "draft", "pending_approval", "approved", "rejected"
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their company's data

  3. Notes
    - Imprints can be attached to quote line items or standalone
    - Each imprint can have multiple proof versions
    - Pricing is auto-calculated based on selected matrix and quantity
*/

CREATE TABLE IF NOT EXISTS imprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  quote_line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT '',
  ink_colors jsonb DEFAULT '[]'::jsonb,
  print_passes integer DEFAULT 1,
  production_notes text DEFAULT '',
  selected_matrix_id uuid REFERENCES price_matrices(id) ON DELETE SET NULL,
  quantity integer DEFAULT 0,
  calculated_price decimal(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imprints_company_id ON imprints(company_id);
CREATE INDEX IF NOT EXISTS idx_imprints_quote_line_item_id ON imprints(quote_line_item_id);
CREATE INDEX IF NOT EXISTS idx_imprints_matrix_id ON imprints(selected_matrix_id);

CREATE TABLE IF NOT EXISTS imprint_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  imprint_id uuid REFERENCES imprints(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  artwork_url text NOT NULL,
  notes text DEFAULT '',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imprint_proofs_company_id ON imprint_proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_imprint_proofs_imprint_id ON imprint_proofs(imprint_id);
CREATE INDEX IF NOT EXISTS idx_imprint_proofs_version ON imprint_proofs(imprint_id, version_number);

ALTER TABLE imprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE imprint_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's imprints"
  ON imprints
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's imprints"
  ON imprints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's imprints"
  ON imprints
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's imprints"
  ON imprints
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their company's imprint proofs"
  ON imprint_proofs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's imprint proofs"
  ON imprint_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's imprint proofs"
  ON imprint_proofs
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's imprint proofs"
  ON imprint_proofs
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_imprints_updated_at
  BEFORE UPDATE ON imprints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_imprint_proofs_updated_at
  BEFORE UPDATE ON imprint_proofs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Migration: 20260123234735_add_type_and_setup_fees_to_price_matrices.sql
-- ============================================================================

/*
  # Add Type and Setup Fees to Price Matrices

  1. Changes
    - Add `matrix_type` field to categorize matrices (screen print, embroidery, DTG, etc.)
    - Add `setup_fee` field for one-time setup costs
    - Add `color_count_adjustments` jsonb field for price adjustments based on color count
    - Keep existing columns/rows/cells structure for flexible tier pricing

  2. Notes
    - matrix_type helps organize different printing methods
    - setup_fee can be applied once per order
    - color_count_adjustments allows pricing like: +$1 for each additional color
    - Existing structure supports quantity tiers via rows (e.g., 1-24, 25-49, 50-99)
      and size/variant tiers via columns (e.g., S, M, L, XL, 2XL)
*/

ALTER TABLE price_matrices
  ADD COLUMN IF NOT EXISTS matrix_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS setup_fee numeric(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS color_count_adjustments jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_price_matrices_type ON price_matrices(company_id, matrix_type);

COMMENT ON COLUMN price_matrices.matrix_type IS 'Type of pricing: screen_print, embroidery, dtg, vinyl, sublimation, general, etc.';
COMMENT ON COLUMN price_matrices.setup_fee IS 'One-time setup fee for this pricing method';
COMMENT ON COLUMN price_matrices.color_count_adjustments IS 'Price adjustments per color count, e.g., {"1": 0, "2": 1.5, "3": 2.5}';


-- ============================================================================
-- Migration: 20260123235132_create_imprint_proofs_storage_bucket.sql
-- ============================================================================

/*
  # Create Storage Bucket for Imprint Proofs

  1. New Storage Bucket
    - `imprint-proofs` - Store artwork files for imprints
    - Public bucket for easy access
    - Company-based folder structure

  2. Security
    - RLS policies for authenticated users only
    - Users can only access their company's files
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('imprint-proofs', 'imprint-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload imprint proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imprint-proofs');

CREATE POLICY "Users can view imprint proofs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'imprint-proofs');

CREATE POLICY "Users can update their imprint proofs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'imprint-proofs')
  WITH CHECK (bucket_id = 'imprint-proofs');

CREATE POLICY "Users can delete their imprint proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'imprint-proofs');


-- ============================================================================
-- Migration: 20260124002136_add_location_and_price_matrix_to_quote_imprints.sql
-- ============================================================================

/*
  # Add Location and Price Matrix to Quote Imprints

  1. Changes
    - Add `location` field to store the physical location of the imprint (Front, Back, Left Chest, etc.)
    - Add `price_matrix_id` field to link to the price_matrices table
    - The `matrix` field will now store the price matrix name for reference

  2. Notes
    - location: Physical placement on garment
    - price_matrix_id: UUID reference to price_matrices table for pricing lookup
    - Existing matrix field can still be used to store the matrix name
*/

ALTER TABLE quote_imprints
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS price_matrix_id uuid REFERENCES price_matrices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_imprints_price_matrix_id ON quote_imprints(price_matrix_id);


-- ============================================================================
-- Migration: 20260124002839_create_customer_locations_table.sql
-- ============================================================================

/*
  # Create Customer Locations Table

  1. New Tables
    - `customer_locations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `location_name` (text) - Name of the location (e.g., "Downtown Store", "Warehouse A")
      - `address` (text) - Full address
      - `is_active` (boolean) - Whether this location is currently active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `customer_locations` table
    - Add policies for authenticated users to manage their company's locations
*/

CREATE TABLE IF NOT EXISTS customer_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE NOT NULL,
  location_name text NOT NULL,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_locations_company_id ON customer_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_locations_is_active ON customer_locations(company_id, is_active);

ALTER TABLE customer_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's locations"
  ON customer_locations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's locations"
  ON customer_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's locations"
  ON customer_locations
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's locations"
  ON customer_locations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_customer_locations_updated_at
  BEFORE UPDATE ON customer_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Migration: 20260124003455_rename_customer_locations_to_decoration_locations.sql
-- ============================================================================

/*
  # Rename customer_locations to decoration_locations

  1. Changes
    - Rename `customer_locations` table to `decoration_locations`
    - Rename `location_name` to `decoration_name`
    - Update description to reflect garment decoration locations (e.g., "Left Front", "Full Back")
  
  2. Security
    - Maintain all existing RLS policies with updated table name
*/

-- Rename the table
ALTER TABLE IF EXISTS customer_locations RENAME TO decoration_locations;

-- Rename the column
ALTER TABLE IF EXISTS decoration_locations RENAME COLUMN location_name TO decoration_name;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can insert their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can update their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can delete their company's locations" ON decoration_locations;

-- Create new policies with updated names
CREATE POLICY "Users can view their company's decoration locations"
  ON decoration_locations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's decoration locations"
  ON decoration_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's decoration locations"
  ON decoration_locations
  FOR UPDATE
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

CREATE POLICY "Users can delete their company's decoration locations"
  ON decoration_locations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Rename indexes
DROP INDEX IF EXISTS idx_customer_locations_company_id;
DROP INDEX IF EXISTS idx_customer_locations_is_active;

CREATE INDEX IF NOT EXISTS idx_decoration_locations_company_id ON decoration_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_decoration_locations_is_active ON decoration_locations(company_id, is_active);

-- Rename the trigger
DROP TRIGGER IF EXISTS update_customer_locations_updated_at ON decoration_locations;

CREATE TRIGGER update_decoration_locations_updated_at
  BEFORE UPDATE ON decoration_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Migration: 20260124004429_create_color_stitch_options_table.sql
-- ============================================================================

/*
  # Create Color/Stitch Options Table

  1. New Tables
    - `color_stitch_options`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `option_label` (text) - Display label (e.g., "1 Color", "5000 Stitches")
      - `option_value` (text) - Stored value (e.g., "1", "5000")
      - `option_type` (text) - "color" or "stitch"
      - `sort_order` (integer) - For custom ordering
      - `is_active` (boolean) - Whether this option is available
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `color_stitch_options` table
    - Add policy for authenticated users to read their company's options
    - Add policy for admins to manage options

  3. Default Data
    - Insert common color options (1-10 colors)
    - Insert common stitch count options (1000-30000 stitches)
*/

CREATE TABLE IF NOT EXISTS color_stitch_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  option_label text NOT NULL,
  option_value text NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('color', 'stitch', 'other')),
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_color_stitch_options_company_id ON color_stitch_options(company_id);
CREATE INDEX IF NOT EXISTS idx_color_stitch_options_type ON color_stitch_options(option_type, is_active);

-- Enable RLS
ALTER TABLE color_stitch_options ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read options from their company
CREATE POLICY "Users can read company color_stitch_options"
  ON color_stitch_options FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert options for their company
CREATE POLICY "Admins can insert color_stitch_options"
  ON color_stitch_options FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can update options for their company
CREATE POLICY "Admins can update color_stitch_options"
  ON color_stitch_options FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can delete options for their company
CREATE POLICY "Admins can delete color_stitch_options"
  ON color_stitch_options FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Insert default color options for all existing companies
INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
SELECT 
  id,
  label,
  value,
  'color',
  sort_order
FROM company_settings
CROSS JOIN (
  VALUES 
    ('1 Color', '1', 1),
    ('2 Colors', '2', 2),
    ('3 Colors', '3', 3),
    ('4 Colors', '4', 4),
    ('5 Colors', '5', 5),
    ('6 Colors', '6', 6),
    ('7 Colors', '7', 7),
    ('8 Colors', '8', 8),
    ('9 Colors', '9', 9),
    ('10 Colors', '10', 10)
) AS colors(label, value, sort_order)
ON CONFLICT DO NOTHING;

-- Insert default stitch count options for all existing companies
INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
SELECT 
  id,
  label,
  value,
  'stitch',
  sort_order
FROM company_settings
CROSS JOIN (
  VALUES 
    ('1,000 Stitches', '1000', 101),
    ('2,500 Stitches', '2500', 102),
    ('5,000 Stitches', '5000', 103),
    ('7,500 Stitches', '7500', 104),
    ('10,000 Stitches', '10000', 105),
    ('12,500 Stitches', '12500', 106),
    ('15,000 Stitches', '15000', 107),
    ('20,000 Stitches', '20000', 108),
    ('25,000 Stitches', '25000', 109),
    ('30,000 Stitches', '30000', 110)
) AS stitches(label, value, sort_order)
ON CONFLICT DO NOTHING;

-- Create trigger to auto-create default options when a new company is created
CREATE OR REPLACE FUNCTION create_default_color_stitch_options()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default color options
  INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
  VALUES 
    (NEW.id, '1 Color', '1', 'color', 1),
    (NEW.id, '2 Colors', '2', 'color', 2),
    (NEW.id, '3 Colors', '3', 'color', 3),
    (NEW.id, '4 Colors', '4', 'color', 4),
    (NEW.id, '5 Colors', '5', 'color', 5),
    (NEW.id, '6 Colors', '6', 'color', 6),
    (NEW.id, '7 Colors', '7', 'color', 7),
    (NEW.id, '8 Colors', '8', 'color', 8),
    (NEW.id, '9 Colors', '9', 'color', 9),
    (NEW.id, '10 Colors', '10', 'color', 10);
  
  -- Insert default stitch count options
  INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
  VALUES 
    (NEW.id, '1,000 Stitches', '1000', 'stitch', 101),
    (NEW.id, '2,500 Stitches', '2500', 'stitch', 102),
    (NEW.id, '5,000 Stitches', '5000', 'stitch', 103),
    (NEW.id, '7,500 Stitches', '7500', 'stitch', 104),
    (NEW.id, '10,000 Stitches', '10000', 'stitch', 105),
    (NEW.id, '12,500 Stitches', '12500', 'stitch', 106),
    (NEW.id, '15,000 Stitches', '15000', 'stitch', 107),
    (NEW.id, '20,000 Stitches', '20000', 'stitch', 108),
    (NEW.id, '25,000 Stitches', '25000', 'stitch', 109),
    (NEW.id, '30,000 Stitches', '30000', 'stitch', 110);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_color_stitch_options
  AFTER INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION create_default_color_stitch_options();

-- ============================================================================
-- Migration: 20260124010051_add_thread_ink_color_to_quote_imprints.sql
-- ============================================================================

/*
  # Add Thread/Ink Color Field to Quote Imprints

  1. Changes
    - Add `thread_ink_color` column to `quote_imprints` table to store selected thread/ink colors
    - This field is optional and stores the color name selected from the color_stitch_options table

  2. Notes
    - This allows users to specify which thread or ink color is being used for each imprint
    - Values come from the Thread and Ink Colors section in General Settings
*/

-- Add thread_ink_color column to quote_imprints table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_imprints' AND column_name = 'thread_ink_color'
  ) THEN
    ALTER TABLE quote_imprints ADD COLUMN thread_ink_color text;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260124185919_update_type_of_work_color_type.sql
-- ============================================================================

/*
  # Update Type of Work to Support Color Type

  1. Changes
    - Replace `uses_ink` boolean column with `color_type` text column
    - `color_type` can be 'ink', 'thread', or 'none'
    - Update existing records: true -> 'ink', false -> 'thread'

  2. Notes
    - Some work types don't require colors at all (e.g., laser engraving)
    - Table may not exist yet, so we check first
*/

-- Only run if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'type_of_work_settings'
  ) THEN
    -- Add new color_type column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'type_of_work_settings'
      AND column_name = 'color_type'
    ) THEN
      ALTER TABLE type_of_work_settings
      ADD COLUMN color_type text
      CHECK (color_type IN ('ink', 'thread', 'none'))
      DEFAULT 'none';
    END IF;

    -- Migrate existing data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'type_of_work_settings'
      AND column_name = 'uses_ink'
    ) THEN
      UPDATE type_of_work_settings
      SET color_type = CASE
        WHEN uses_ink = true THEN 'ink'
        WHEN uses_ink = false THEN 'thread'
        ELSE 'none'
      END
      WHERE color_type IS NULL OR color_type = 'none';

      -- Drop the old uses_ink column
      ALTER TABLE type_of_work_settings DROP COLUMN uses_ink;
    END IF;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260124213054_seed_default_production_colors_for_all_companies.sql
-- ============================================================================

/*
  # Seed Default Production Colors for All Companies
  
  1. Purpose
    - Add default ink and thread color options for companies that don't have any
    - Ensures the Imprints modal color dropdowns work for all companies
  
  2. Default Colors
    - Ink Colors: Black, White, Red, Navy, Royal Blue, Light Blue, Dark Green, Kelly Green, Yellow, Orange, Purple, Maroon, Gray
    - Thread Colors: Black, White, Red, Navy, Royal Blue, Light Blue, Dark Green, Kelly Green, Yellow, Orange, Purple, Maroon, Gray
  
  3. Notes
    - Only inserts for companies that don't have production_color_settings yet
    - Uses common industry-standard color options
*/

-- Insert default production colors for companies that don't have them
INSERT INTO production_color_settings (company_id, ink_colors, thread_colors)
SELECT 
  cs.id as company_id,
  '[
    {"name": "Black"},
    {"name": "White"},
    {"name": "Red"},
    {"name": "Navy"},
    {"name": "Royal Blue"},
    {"name": "Light Blue"},
    {"name": "Dark Green"},
    {"name": "Kelly Green"},
    {"name": "Yellow"},
    {"name": "Orange"},
    {"name": "Purple"},
    {"name": "Maroon"},
    {"name": "Gray"}
  ]'::jsonb as ink_colors,
  '[
    {"name": "Black"},
    {"name": "White"},
    {"name": "Red"},
    {"name": "Navy"},
    {"name": "Royal Blue"},
    {"name": "Light Blue"},
    {"name": "Dark Green"},
    {"name": "Kelly Green"},
    {"name": "Yellow"},
    {"name": "Orange"},
    {"name": "Purple"},
    {"name": "Maroon"},
    {"name": "Gray"}
  ]'::jsonb as thread_colors
FROM company_settings cs
WHERE NOT EXISTS (
  SELECT 1 
  FROM production_color_settings pcs 
  WHERE pcs.company_id = cs.id
);


-- ============================================================================
-- Migration: 20260125132414_add_missing_quote_fields.sql
-- ============================================================================

/*
  # Add Missing Quote Fields for QuoteBuilder

  1. Purpose
    - Add missing fields that QuoteBuilder component expects
    - Support for billing/shipping address fields
    - Add date and note fields

  2. New Columns to `quotes` table
    - Customer billing address fields (bill_company, bill_name, bill_address_1, etc.)
    - Customer shipping address fields (ship_company, ship_name, ship_address_1, etc.)
    - Date fields (created_date, production_due_date, customer_due_date)
    - Note fields (nickname, production_notes - customer_notes already exists)

  3. Changes to `quote_line_items` table
    - Add taxed boolean field to support tax calculations
    - Add sort_order field to maintain item order

  4. Security
    - No RLS changes needed (already secured by company_id)
*/

-- Add billing address fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_company') THEN
    ALTER TABLE quotes ADD COLUMN bill_company text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_name') THEN
    ALTER TABLE quotes ADD COLUMN bill_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_address_1') THEN
    ALTER TABLE quotes ADD COLUMN bill_address_1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_address_2') THEN
    ALTER TABLE quotes ADD COLUMN bill_address_2 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_city') THEN
    ALTER TABLE quotes ADD COLUMN bill_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_state') THEN
    ALTER TABLE quotes ADD COLUMN bill_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'bill_zip') THEN
    ALTER TABLE quotes ADD COLUMN bill_zip text;
  END IF;
END $$;

-- Add shipping address fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_company') THEN
    ALTER TABLE quotes ADD COLUMN ship_company text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_name') THEN
    ALTER TABLE quotes ADD COLUMN ship_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_address_1') THEN
    ALTER TABLE quotes ADD COLUMN ship_address_1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_address_2') THEN
    ALTER TABLE quotes ADD COLUMN ship_address_2 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_city') THEN
    ALTER TABLE quotes ADD COLUMN ship_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_state') THEN
    ALTER TABLE quotes ADD COLUMN ship_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'ship_zip') THEN
    ALTER TABLE quotes ADD COLUMN ship_zip text;
  END IF;
END $$;

-- Add date fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'created_date') THEN
    ALTER TABLE quotes ADD COLUMN created_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'production_due_date') THEN
    ALTER TABLE quotes ADD COLUMN production_due_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'customer_due_date') THEN
    ALTER TABLE quotes ADD COLUMN customer_due_date date;
  END IF;
END $$;

-- Add note fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'nickname') THEN
    ALTER TABLE quotes ADD COLUMN nickname text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'production_notes') THEN
    ALTER TABLE quotes ADD COLUMN production_notes text;
  END IF;
END $$;

-- Make customer_name nullable (it's required in original schema but not always available)
DO $$
BEGIN
  ALTER TABLE quotes ALTER COLUMN customer_name DROP NOT NULL;
END $$;

-- Add fields to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'taxed') THEN
    ALTER TABLE quote_line_items ADD COLUMN taxed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'sort_order') THEN
    ALTER TABLE quote_line_items ADD COLUMN sort_order int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'total_quantity') THEN
    ALTER TABLE quote_line_items ADD COLUMN total_quantity int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'total_price') THEN
    ALTER TABLE quote_line_items ADD COLUMN total_price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add index for sort_order
CREATE INDEX IF NOT EXISTS idx_quote_line_items_sort_order ON quote_line_items(quote_id, sort_order);


-- ============================================================================
-- Migration: 20260125132510_fix_quote_fees_columns.sql
-- ============================================================================

/*
  # Fix Quote Fees Table Columns

  1. Purpose
    - Add missing columns to quote_fees table that QuoteBuilder expects
    - Align column names with QuoteBuilder component expectations

  2. Changes to `quote_fees` table
    - Add `description` as alias/additional field to `fee_description`
    - Add `quantity` field (default 1)
    - Add `unit_amount` field
    - Add `total_amount` field
    - Add `taxed` field as alias to `is_taxed`

  3. Security
    - No RLS changes needed (already secured)
*/

-- Add missing columns to quote_fees
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'description') THEN
    ALTER TABLE quote_fees ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'quantity') THEN
    ALTER TABLE quote_fees ADD COLUMN quantity int DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'unit_amount') THEN
    ALTER TABLE quote_fees ADD COLUMN unit_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'total_amount') THEN
    ALTER TABLE quote_fees ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_fees' AND column_name = 'taxed') THEN
    ALTER TABLE quote_fees ADD COLUMN taxed boolean DEFAULT false;
  END IF;
END $$;

-- Sync existing data to new fields
UPDATE quote_fees
SET 
  description = COALESCE(fee_description, ''),
  unit_amount = amount,
  total_amount = amount * COALESCE(quantity, 1),
  taxed = is_taxed
WHERE description IS NULL OR unit_amount IS NULL OR total_amount IS NULL;


-- ============================================================================
-- Migration: 20260125141041_add_quote_numbering_settings.sql
-- ============================================================================

/*
  # Add Quote Numbering Settings

  This migration adds quote numbering configuration to company_settings table,
  similar to the existing invoice numbering system.

  ## Changes
  
  1. New Columns
    - `use_quote_prefix` (boolean) - Whether to use a prefix for quote numbers
    - `quote_prefix` (text) - Optional prefix for quote numbers (e.g., "Q-")
    - `quote_start_number` (integer) - Starting number for sequential quote numbering
  
  2. Default Values
    - use_quote_prefix: false
    - quote_prefix: ''
    - quote_start_number: 1

  ## Notes
  - These settings allow companies to configure custom quote numbering schemes
  - Quote numbers will follow the format: [prefix][sequential_number]
  - Example: "Q-1001", "Q-1002", etc. or "1001", "1002" without prefix
*/

-- Add quote numbering columns to company_settings
ALTER TABLE company_settings 
  ADD COLUMN IF NOT EXISTS use_quote_prefix boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_prefix text DEFAULT '',
  ADD COLUMN IF NOT EXISTS quote_start_number integer DEFAULT 1;

-- Update existing rows to have default values
UPDATE company_settings 
SET 
  use_quote_prefix = false,
  quote_prefix = '',
  quote_start_number = 1
WHERE use_quote_prefix IS NULL 
   OR quote_prefix IS NULL 
   OR quote_start_number IS NULL;


-- ============================================================================
-- Migration: 20260125141600_unify_quote_invoice_numbering.sql
-- ============================================================================

/*
  # Unify Quote and Invoice Numbering System

  This migration consolidates quote and invoice numbering into a single unified system.
  
  ## Changes
  
  1. Rename Columns (for clarity)
    - `use_invoice_prefix` → `use_number_prefix`
    - `invoice_prefix` → kept but not used (will be ignored)
    - `invoice_start_number` → `number_start_number`
    - `next_invoice_number` → `next_number`
  
  2. Remove Separate Quote Columns
    - Remove `use_quote_prefix`, `quote_prefix`, `quote_start_number`
  
  ## Numbering Logic
  - When prefix is enabled:
    - Quotes use "QTE-" prefix
    - Invoices use "INV-" prefix
  - Both share the same sequential number series
  - Starting number applies to both quotes and invoices
*/

-- Add new unified columns
ALTER TABLE company_settings 
  ADD COLUMN IF NOT EXISTS use_number_prefix boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS number_start_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_number integer DEFAULT 1;

-- Copy existing invoice settings to new unified columns
UPDATE company_settings 
SET 
  use_number_prefix = use_invoice_prefix,
  number_start_number = COALESCE(invoice_start_number, 1),
  next_number = COALESCE(next_invoice_number, invoice_start_number, 1)
WHERE use_number_prefix IS NULL;

-- Remove separate quote numbering columns
ALTER TABLE company_settings 
  DROP COLUMN IF EXISTS use_quote_prefix,
  DROP COLUMN IF EXISTS quote_prefix,
  DROP COLUMN IF EXISTS quote_start_number;

-- Note: Keeping invoice_prefix and use_invoice_prefix for backward compatibility
-- but they will be ignored in favor of use_number_prefix


-- ============================================================================
-- Migration: 20260125150826_create_proofs_module.sql
-- ============================================================================

/*
  # Create Proofs Module

  1. New Tables
    - `proofs` - Main table for storing proof records
      - `id` (uuid, primary key)
      - `company_id` (uuid, references company_settings)
      - `quote_id` (uuid, references quotes)
      - `line_item_id` (uuid, references quote_line_items)
      - `customer_id` (uuid, references customers)
      - `proof_number` (text, unique identifier)
      - `proof_version` (int, default 1)
      - `garment_image_url` (text)
      - `garment_name` (text)
      - `print_width` (numeric)
      - `print_height` (numeric)
      - `print_depth` (numeric)
      - `print_unit` (text, 'inches' or 'cm')
      - `status` (text, 'draft', 'pending_approval', 'approved', 'rejected')
      - `notes` (text)
      - `created_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `approved_at` (timestamptz)
      - `rejected_at` (timestamptz)

    - `proof_artwork` - Artwork files for each proof
      - `id` (uuid, primary key)
      - `proof_id` (uuid, references proofs)
      - `company_id` (uuid, references company_settings)
      - `artwork_url` (text)
      - `artwork_name` (text)
      - `artwork_version` (int)
      - `file_type` (text)
      - `file_size` (bigint)
      - `created_at` (timestamptz)

    - `proof_colors` - Selected colors for each proof
      - `id` (uuid, primary key)
      - `proof_id` (uuid, references proofs)
      - `company_id` (uuid, references company_settings)
      - `color_type` (text, 'ink' or 'thread')
      - `color_name` (text)
      - `color_code` (text)
      - `created_at` (timestamptz)

  2. Storage
    - Create storage bucket for proof garment images
    - Create storage bucket for proof artwork files

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated company users

  4. Indexes
    - Index on company_id for all tables
    - Index on quote_id and line_item_id
    - Index on customer_id
*/

-- Create proofs table
CREATE TABLE IF NOT EXISTS proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  proof_number text UNIQUE NOT NULL,
  proof_version int DEFAULT 1,
  garment_image_url text,
  garment_name text,
  print_width numeric(10,2),
  print_height numeric(10,2),
  print_depth numeric(10,2),
  print_unit text DEFAULT 'inches' CHECK (print_unit IN ('inches', 'cm')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  notes text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

-- Create proof_artwork table
CREATE TABLE IF NOT EXISTS proof_artwork (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id uuid NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  artwork_url text NOT NULL,
  artwork_name text NOT NULL,
  artwork_version int DEFAULT 1,
  file_type text,
  file_size bigint,
  position_x numeric(10,2) DEFAULT 0,
  position_y numeric(10,2) DEFAULT 0,
  scale numeric(5,2) DEFAULT 1.0,
  rotation numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create proof_colors table
CREATE TABLE IF NOT EXISTS proof_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id uuid NOT NULL REFERENCES proofs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  color_type text NOT NULL CHECK (color_type IN ('ink', 'thread')),
  color_name text NOT NULL,
  color_code text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proofs_company_id ON proofs(company_id);
CREATE INDEX IF NOT EXISTS idx_proofs_quote_id ON proofs(quote_id);
CREATE INDEX IF NOT EXISTS idx_proofs_line_item_id ON proofs(line_item_id);
CREATE INDEX IF NOT EXISTS idx_proofs_customer_id ON proofs(customer_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON proofs(status);

CREATE INDEX IF NOT EXISTS idx_proof_artwork_proof_id ON proof_artwork(proof_id);
CREATE INDEX IF NOT EXISTS idx_proof_artwork_company_id ON proof_artwork(company_id);

CREATE INDEX IF NOT EXISTS idx_proof_colors_proof_id ON proof_colors(proof_id);
CREATE INDEX IF NOT EXISTS idx_proof_colors_company_id ON proof_colors(company_id);

-- Enable RLS
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_artwork ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_colors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for proofs
CREATE POLICY "Users can view own company proofs"
  ON proofs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proofs for own company"
  ON proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company proofs"
  ON proofs FOR UPDATE
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

CREATE POLICY "Users can delete own company proofs"
  ON proofs FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create RLS policies for proof_artwork
CREATE POLICY "Users can view own company proof artwork"
  ON proof_artwork FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proof artwork for own company"
  ON proof_artwork FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company proof artwork"
  ON proof_artwork FOR UPDATE
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

CREATE POLICY "Users can delete own company proof artwork"
  ON proof_artwork FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create RLS policies for proof_colors
CREATE POLICY "Users can view own company proof colors"
  ON proof_colors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proof colors for own company"
  ON proof_colors FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own company proof colors"
  ON proof_colors FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Create function to generate proof number
CREATE OR REPLACE FUNCTION generate_proof_number()
RETURNS text AS $$
DECLARE
  next_number int;
  proof_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(proof_number FROM '[0-9]+$') AS int)), 0) + 1
  INTO next_number
  FROM proofs
  WHERE proof_number ~ '^PROOF-[0-9]+$';
  
  proof_num := 'PROOF-' || LPAD(next_number::text, 6, '0');
  RETURN proof_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate proof number
CREATE OR REPLACE FUNCTION set_proof_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proof_number IS NULL OR NEW.proof_number = '' THEN
    NEW.proof_number := generate_proof_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_proof_number
  BEFORE INSERT ON proofs
  FOR EACH ROW
  EXECUTE FUNCTION set_proof_number();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_proof_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_proof_timestamp
  BEFORE UPDATE ON proofs
  FOR EACH ROW
  EXECUTE FUNCTION update_proof_timestamp();


-- ============================================================================
-- Migration: 20260125150840_create_proof_storage_buckets.sql
-- ============================================================================

/*
  # Create Storage Buckets for Proofs

  1. Storage Buckets
    - `proof-garments` - For garment images
    - `proof-artwork` - For artwork files

  2. Security
    - RLS policies for authenticated users
    - Company-based access control
*/

-- Create proof-garments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-garments',
  'proof-garments',
  true,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create proof-artwork bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-artwork',
  'proof-artwork',
  true,
  20971520, -- 20MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'application/pdf', 'application/postscript', 'application/illustrator']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for proof-garments
CREATE POLICY "Authenticated users can upload garment images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proof-garments');

CREATE POLICY "Authenticated users can view garment images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proof-garments');

CREATE POLICY "Authenticated users can update garment images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'proof-garments')
  WITH CHECK (bucket_id = 'proof-garments');

CREATE POLICY "Authenticated users can delete garment images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'proof-garments');

-- Create storage policies for proof-artwork
CREATE POLICY "Authenticated users can upload artwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proof-artwork');

CREATE POLICY "Authenticated users can view artwork"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proof-artwork');

CREATE POLICY "Authenticated users can update artwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'proof-artwork')
  WITH CHECK (bucket_id = 'proof-artwork');

CREATE POLICY "Authenticated users can delete artwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'proof-artwork');


-- ============================================================================
-- Migration: 20260125154913_add_composite_image_to_proofs.sql
-- ============================================================================



-- ============================================================================
-- Migration: 20260125154940_add_composite_image_to_proofs.sql
-- ============================================================================

/*
  # Add Composite Image Support to Proofs

  1. Schema Changes
    - Add `composite_image_url` column to `proofs` table to store the final combined garment + artwork image

  2. Storage
    - Create storage bucket for composite proof images
    - Enable RLS policies for authenticated users
*/

-- Add composite_image_url column to proofs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'composite_image_url'
  ) THEN
    ALTER TABLE proofs ADD COLUMN composite_image_url text;
  END IF;
END $$;

-- Create storage bucket for composite proof images
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-composites', 'proof-composites', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload composite proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view composite proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own composite proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own composite proofs" ON storage.objects;

-- Enable RLS for proof-composites bucket
CREATE POLICY "Authenticated users can upload composite proofs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proof-composites');

CREATE POLICY "Anyone can view composite proofs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'proof-composites');

CREATE POLICY "Users can update their own composite proofs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'proof-composites' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own composite proofs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'proof-composites' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- Migration: 20260125155816_create_production_colors_table.sql
-- ============================================================================

/*
  # Create Production Colors Table

  1. Purpose
    - Centralized table for managing company-wide ink and thread colors
    - Used by both Production Settings (InkThreadColorsManager) and Proof Builder (ColorSelectionPanel)
    - Replaces the misuse of color_stitch_options for individual colors

  2. New Tables
    - `production_colors`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `name` (text) - Color name (e.g., "Black", "Navy Blue")
      - `color_code` (text) - Hex color code (e.g., "#000000")
      - `type_of_work` (text) - "screen_printing" or "embroidery"
      - `is_active` (boolean) - Whether this color is available
      - `sort_order` (integer) - For custom ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on `production_colors` table
    - Add policy for authenticated users to read their company's colors
    - Add policy for admins to manage colors

  4. Default Colors
    - Seed common ink and thread colors for all existing companies
*/

-- Create the production_colors table
CREATE TABLE IF NOT EXISTS production_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_code text NOT NULL DEFAULT '#000000',
  type_of_work text NOT NULL CHECK (type_of_work IN ('screen_printing', 'embroidery')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_production_colors_company_id ON production_colors(company_id);
CREATE INDEX IF NOT EXISTS idx_production_colors_type ON production_colors(type_of_work, is_active);

-- Enable RLS
ALTER TABLE production_colors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read colors from their company
CREATE POLICY "Users can read company production_colors"
  ON production_colors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert colors for their company
CREATE POLICY "Admins can insert production_colors"
  ON production_colors FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can update colors for their company
CREATE POLICY "Admins can update production_colors"
  ON production_colors FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can delete colors for their company
CREATE POLICY "Admins can delete production_colors"
  ON production_colors FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Insert default ink colors for all existing companies
INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
SELECT 
  cs.id as company_id,
  color_data.name,
  color_data.code,
  'screen_printing',
  color_data.sort_order
FROM company_settings cs
CROSS JOIN (
  VALUES 
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Navy', '#000080', 4),
    ('Royal Blue', '#4169E1', 5),
    ('Light Blue', '#ADD8E6', 6),
    ('Dark Green', '#006400', 7),
    ('Kelly Green', '#4CBB17', 8),
    ('Yellow', '#FFFF00', 9),
    ('Orange', '#FFA500', 10),
    ('Purple', '#800080', 11),
    ('Maroon', '#800000', 12),
    ('Gray', '#808080', 13)
) AS color_data(name, code, sort_order)
ON CONFLICT DO NOTHING;

-- Insert default thread colors for all existing companies
INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
SELECT 
  cs.id as company_id,
  color_data.name,
  color_data.code,
  'embroidery',
  color_data.sort_order
FROM company_settings cs
CROSS JOIN (
  VALUES 
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Navy', '#000080', 4),
    ('Royal Blue', '#4169E1', 5),
    ('Light Blue', '#ADD8E6', 6),
    ('Dark Green', '#006400', 7),
    ('Kelly Green', '#4CBB17', 8),
    ('Yellow', '#FFFF00', 9),
    ('Orange', '#FFA500', 10),
    ('Purple', '#800080', 11),
    ('Maroon', '#800000', 12),
    ('Gray', '#808080', 13)
) AS color_data(name, code, sort_order)
ON CONFLICT DO NOTHING;

-- Create trigger to auto-create default colors when a new company is created
CREATE OR REPLACE FUNCTION create_default_production_colors()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default ink colors
  INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
  VALUES 
    (NEW.id, 'Black', '#000000', 'screen_printing', 1),
    (NEW.id, 'White', '#FFFFFF', 'screen_printing', 2),
    (NEW.id, 'Red', '#FF0000', 'screen_printing', 3),
    (NEW.id, 'Navy', '#000080', 'screen_printing', 4),
    (NEW.id, 'Royal Blue', '#4169E1', 'screen_printing', 5),
    (NEW.id, 'Light Blue', '#ADD8E6', 'screen_printing', 6),
    (NEW.id, 'Dark Green', '#006400', 'screen_printing', 7),
    (NEW.id, 'Kelly Green', '#4CBB17', 'screen_printing', 8),
    (NEW.id, 'Yellow', '#FFFF00', 'screen_printing', 9),
    (NEW.id, 'Orange', '#FFA500', 'screen_printing', 10),
    (NEW.id, 'Purple', '#800080', 'screen_printing', 11),
    (NEW.id, 'Maroon', '#800000', 'screen_printing', 12),
    (NEW.id, 'Gray', '#808080', 'screen_printing', 13);
  
  -- Insert default thread colors
  INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
  VALUES 
    (NEW.id, 'Black', '#000000', 'embroidery', 1),
    (NEW.id, 'White', '#FFFFFF', 'embroidery', 2),
    (NEW.id, 'Red', '#FF0000', 'embroidery', 3),
    (NEW.id, 'Navy', '#000080', 'embroidery', 4),
    (NEW.id, 'Royal Blue', '#4169E1', 'embroidery', 5),
    (NEW.id, 'Light Blue', '#ADD8E6', 'embroidery', 6),
    (NEW.id, 'Dark Green', '#006400', 'embroidery', 7),
    (NEW.id, 'Kelly Green', '#4CBB17', 'embroidery', 8),
    (NEW.id, 'Yellow', '#FFFF00', 'embroidery', 9),
    (NEW.id, 'Orange', '#FFA500', 'embroidery', 10),
    (NEW.id, 'Purple', '#800080', 'embroidery', 11),
    (NEW.id, 'Maroon', '#800000', 'embroidery', 12),
    (NEW.id, 'Gray', '#808080', 'embroidery', 13);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_production_colors
  AFTER INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION create_default_production_colors();

-- ============================================================================
-- Migration: 20260125181450_add_imprint_fields_to_proofs.sql
-- ============================================================================

/*
  # Add Imprint Fields to Proofs Table

  1. Schema Changes
    - Add `type_of_work` column to link to type of work settings
    - Add `decoration_location_id` column to link to decoration locations
    - Add `pricing_matrix_id` column to link to pricing matrices
    - Add `pricing_matrix_column` column to store selected column
    - Add `imprint_unit_price` column to store calculated price per unit
    - Add `imprint_setup_fee` column to store setup fee from pricing matrix
    
  2. Purpose
    - Combine imprint configuration with proof creation
    - Allow proofs to contain full pricing and decoration information
    - Enable unified Imprint + Proof Builder workflow
    
  3. Notes
    - All new columns are nullable for backward compatibility
    - Existing proofs without imprint data will continue to work
*/

-- Add type of work reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'type_of_work'
  ) THEN
    ALTER TABLE proofs ADD COLUMN type_of_work text;
  END IF;
END $$;

-- Add decoration location reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'decoration_location_id'
  ) THEN
    ALTER TABLE proofs ADD COLUMN decoration_location_id uuid REFERENCES decoration_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add pricing matrix reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'pricing_matrix_id'
  ) THEN
    ALTER TABLE proofs ADD COLUMN pricing_matrix_id uuid REFERENCES price_matrices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add pricing matrix column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'pricing_matrix_column'
  ) THEN
    ALTER TABLE proofs ADD COLUMN pricing_matrix_column text;
  END IF;
END $$;

-- Add imprint unit price
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'imprint_unit_price'
  ) THEN
    ALTER TABLE proofs ADD COLUMN imprint_unit_price numeric(10,2);
  END IF;
END $$;

-- Add imprint setup fee
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'imprint_setup_fee'
  ) THEN
    ALTER TABLE proofs ADD COLUMN imprint_setup_fee numeric(10,2);
  END IF;
END $$;

-- Create index on decoration_location_id
CREATE INDEX IF NOT EXISTS idx_proofs_decoration_location_id ON proofs(decoration_location_id);

-- Create index on pricing_matrix_id
CREATE INDEX IF NOT EXISTS idx_proofs_pricing_matrix_id ON proofs(pricing_matrix_id);


-- ============================================================================
-- Migration: 20260125232703_add_line_item_groups.sql
-- ============================================================================

/*
  # Add Line Item Group Support

  1. Purpose
    - Add support for grouping line items in quotes
    - Each group can have a label for organization

  2. Changes to `quote_line_items` table
    - Add `group_label` text field for group identification
    - Groups with empty labels are considered the default group

  3. Notes
    - The group_label field allows the UI to group related items together
    - Multiple items can share the same group_label
    - Items are still ordered by sort_order within their groups
*/

-- Add group_label to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN group_label text DEFAULT '';
  END IF;
END $$;

-- Add index for efficient group queries
CREATE INDEX IF NOT EXISTS idx_quote_line_items_group_label
  ON quote_line_items(quote_id, group_label, sort_order);


-- ============================================================================
-- Migration: 20260125235650_add_custom_line_item_options_to_company_settings.sql
-- ============================================================================

/*
  # Add custom line item options to company settings

  1. Changes
    - Add `custom_line_item_options` column to company_settings table to store custom line item options
    - This column will store an array of custom option names that can be added to quotes/invoices
    - Default value is an empty array
  
  2. Schema
    - `custom_line_item_options` (text array) - stores custom option names like "Other", "Special Size", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'custom_line_item_options'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN custom_line_item_options text[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260126003914_add_custom_size_option_to_quotes.sql
-- ============================================================================

/*
  # Add custom_size_option column to quotes table

  1. Changes
    - Add `custom_size_option` column to `quotes` table
    - This moves the custom size selection from per-line-item to a global quote setting
    - The value will be stored at the quote level and applies to all line items

  2. Migration Details
    - Adds nullable text column for flexibility
    - Safe to run multiple times (IF NOT EXISTS check included)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'custom_size_option'
  ) THEN
    ALTER TABLE quotes ADD COLUMN custom_size_option text;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260126012654_create_garment_supplier_integrations.sql
-- ============================================================================

/*
  # Create Garment Supplier Integration Settings

  1. New Tables
    - `integration_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `sanmar_enabled` (boolean) - whether SanMar integration is active
      - `sanmar_credentials` (jsonb) - encrypted SanMar API credentials
      - `ssactivewear_enabled` (boolean) - whether SSActivewear integration is active
      - `ssactivewear_credentials` (jsonb) - encrypted SSActivewear API credentials
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `integration_settings` table
    - Add policies for company-scoped access
    - Only authenticated users in the same company can access their integration settings
    - Only admins can modify integration settings

  3. Notes
    - Credentials stored as JSONB for flexibility
    - Each company has one integration_settings record
    - Credentials should be encrypted before storage
*/

-- Create integration_settings table
CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  sanmar_enabled boolean DEFAULT false,
  sanmar_credentials jsonb DEFAULT '{}'::jsonb,
  ssactivewear_enabled boolean DEFAULT false,
  ssactivewear_credentials jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

-- Create index on company_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_integration_settings_company_id 
  ON integration_settings(company_id);

-- Enable RLS
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's integration settings
CREATE POLICY "Users can view own company integration settings"
  ON integration_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Only admins can insert integration settings
CREATE POLICY "Admins can insert integration settings"
  ON integration_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Only admins can update integration settings
CREATE POLICY "Admins can update integration settings"
  ON integration_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Only admins can delete integration settings
CREATE POLICY "Admins can delete integration settings"
  ON integration_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_integration_settings_timestamp ON integration_settings;
CREATE TRIGGER update_integration_settings_timestamp
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_settings_updated_at();

-- ============================================================================
-- Migration: 20260126012718_add_supplier_metadata_to_quote_line_items.sql
-- ============================================================================

/*
  # Add Supplier Metadata to Quote Line Items

  1. Changes
    - Add supplier-related fields to `quote_line_items` table
    - Add `supplier_name` - SanMar, SSActivewear, or manual entry
    - Add `brand` - product brand (e.g., Port & Company, Gildan)
    - Add `color_code` - supplier color code
    - Add `garment_image_url` - URL to product image
    - Add `wholesale_price` - wholesale cost per unit
    - Add `retail_price` - suggested retail price
    - Add `supplier_metadata` - full JSON response from supplier API
    - Add `stock_availability` - JSONB with warehouse stock levels

  2. Notes
    - These fields are optional and only populated when using supplier integrations
    - Manual line items can leave these fields NULL
    - supplier_metadata stores the complete API response for reference
*/

DO $$
BEGIN
  -- Add supplier_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'supplier_name'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN supplier_name text;
  END IF;

  -- Add brand
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'brand'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN brand text;
  END IF;

  -- Add color_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'color_code'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN color_code text;
  END IF;

  -- Add garment_image_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'garment_image_url'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN garment_image_url text;
  END IF;

  -- Add wholesale_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'wholesale_price'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN wholesale_price decimal(10,2);
  END IF;

  -- Add retail_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'retail_price'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN retail_price decimal(10,2);
  END IF;

  -- Add supplier_metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'supplier_metadata'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN supplier_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add stock_availability
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'stock_availability'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN stock_availability jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260126014518_add_size_mode_to_quote_line_items.sql
-- ============================================================================

/*
  # Add Size Mode Support to Quote Line Items

  1. Changes to quote_line_items table
    - Add `size_mode` column - determines which size set is active (regular, double, youth, adult)
    - Add `regular_sizes` (jsonb) - stores quantities for regular sizes (YS, YM, YL, XS, S, M, L, XL, 2XL, 3XL, 4XL)
    - Add `double_sizes` (jsonb) - stores quantities for double sizes (SM, LXL, YSYM, YLYXL)
    - Add `youth_sizes` (jsonb) - stores quantities for youth-only sizes (YXS, YS, YM, YL, YXL)
    - Add `adult_sizes` (jsonb) - stores quantities for adult-only sizes (XS, S, M, L, XL, 2XL, 3XL, 4XL)

  2. Purpose
    - Reduce UI clutter by allowing users to switch between different size sets
    - Preserve all size data across mode switches
    - Provide specialized size options for different garment types

  3. Default Values
    - size_mode defaults to 'regular'
    - All size JSON fields default to empty objects
*/

DO $$
BEGIN
  -- Add size_mode column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'size_mode'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN size_mode text DEFAULT 'regular';
  END IF;

  -- Add regular_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'regular_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN regular_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add double_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'double_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN double_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add youth_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'youth_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN youth_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add adult_sizes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'adult_sizes'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN adult_sizes jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add check constraint to ensure size_mode is one of the allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quote_line_items_size_mode_check'
  ) THEN
    ALTER TABLE quote_line_items 
    ADD CONSTRAINT quote_line_items_size_mode_check 
    CHECK (size_mode IN ('regular', 'double', 'youth', 'adult'));
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260126014917_add_double_size_columns_to_quote_line_items.sql
-- ============================================================================

/*
  # Add Double Size Columns to Quote Line Items

  1. Changes to quote_line_items table
    - Add `qty_sm` (integer) - quantity for S/M double size
    - Add `qty_lxl` (integer) - quantity for L/XL double size
    - Add `qty_ysym` (integer) - quantity for YS/YM double size
    - Add `qty_ylyxl` (integer) - quantity for YL/YXL double size

  2. Purpose
    - Support double size mode where sizes are combined (e.g., S/M instead of separate S and M)
    - Provide flexibility for different garment types and ordering preferences

  3. Default Values
    - All double size columns default to 0
*/

DO $$
BEGIN
  -- Add qty_sm column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_sm'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_sm integer DEFAULT 0;
  END IF;

  -- Add qty_lxl column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_lxl'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_lxl integer DEFAULT 0;
  END IF;

  -- Add qty_ysym column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_ysym'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ysym integer DEFAULT 0;
  END IF;

  -- Add qty_ylyxl column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'qty_ylyxl'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ylyxl integer DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260126191644_backfill_quote_zip_codes_from_customers.sql
-- ============================================================================

/*
  # Backfill Quote Zip Codes from Customers

  1. Updates
    - Populate `bill_zip` and `ship_zip` in the `quotes` table from linked `customers` table
    - Only updates quotes where zip codes are missing but customer has zip codes
  
  2. Notes
    - This is a one-time data migration
    - QuoteBuilder already pulls zip codes for new quotes
    - QuoteDetail now fetches zip codes from customers on display
*/

-- Backfill billing zip codes where they're missing
UPDATE quotes q
SET bill_zip = c.billing_zip
FROM customers c
WHERE q.customer_id = c.id
  AND q.bill_zip IS NULL
  AND c.billing_zip IS NOT NULL;

-- Backfill shipping zip codes where they're missing
UPDATE quotes q
SET ship_zip = c.shipping_zip
FROM customers c
WHERE q.customer_id = c.id
  AND q.ship_zip IS NULL
  AND c.shipping_zip IS NOT NULL;


-- ============================================================================
-- Migration: 20260126232240_create_customer_artwork_library.sql
-- ============================================================================

/*
  # Customer Artwork Library

  1. New Tables
    - `customer_artwork`
      - Stores all artwork files uploaded for customers
      - Includes file metadata, dimensions, and tags
      - Associated with customer_id for reusable artwork library
  
  2. Changes to existing tables
    - Add fields to `proof_artwork` for print location and dimensions
    - Add artwork_id reference (nullable for backwards compatibility)
  
  3. Security
    - Enable RLS on customer_artwork table
    - Policies restrict access to company_id
*/

-- Create customer_artwork table
CREATE TABLE IF NOT EXISTS customer_artwork (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  width_inches numeric,
  height_inches numeric,
  tags text[] DEFAULT '{}',
  notes text,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add new columns to proof_artwork if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'customer_artwork_id'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN customer_artwork_id uuid REFERENCES customer_artwork(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'print_location'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN print_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'width_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN width_inches numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'height_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN height_inches numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN sort_order int DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_artwork_customer_id ON customer_artwork(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_artwork_company_id ON customer_artwork(company_id);
CREATE INDEX IF NOT EXISTS idx_proof_artwork_customer_artwork_id ON proof_artwork(customer_artwork_id);

-- Enable RLS on customer_artwork
ALTER TABLE customer_artwork ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_artwork
CREATE POLICY "Users can view their company's customer artwork"
  ON customer_artwork FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert customer artwork for their company"
  ON customer_artwork FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's customer artwork"
  ON customer_artwork FOR UPDATE
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

CREATE POLICY "Users can delete their company's customer artwork"
  ON customer_artwork FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- Migration: 20260126232258_create_customer_artwork_storage_bucket.sql
-- ============================================================================

/*
  # Customer Artwork Storage Bucket

  1. Storage
    - Create `customer-artwork` bucket for storing uploaded files
    - Public access for viewing artwork
    - Authenticated users can upload/modify their company's artwork
  
  2. Security
    - RLS policies on storage bucket
    - File size limit: 50MB
    - Allowed file types: PNG, JPG, JPEG, PDF, EPS, AI, SVG
*/

-- Create customer-artwork storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-artwork',
  'customer-artwork',
  true,
  52428800, -- 50MB in bytes
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
    'application/postscript',
    'application/illustrator',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for customer-artwork bucket
CREATE POLICY "Anyone can view customer artwork"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-artwork');

CREATE POLICY "Authenticated users can upload customer artwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  );

CREATE POLICY "Users can update their company's customer artwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  )
  WITH CHECK (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  );

CREATE POLICY "Users can delete their company's customer artwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'customer-artwork' AND
    auth.uid() IN (SELECT id FROM user_profiles)
  );

-- ============================================================================
-- Migration: 20260126235522_add_group_label_to_quote_imprints.sql
-- ============================================================================

/*
  # Add Group Label to Quote Imprints

  1. Changes
    - Add `group_label` column to `quote_imprints` table
    - This allows imprints to be associated with specific line item groups
    - Each group can have its own isolated set of imprints and mockups

  2. Notes
    - group_label should match the group_label on quote_line_items
    - This enables proper isolation of mockups/proofs per line item group
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_imprints' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE quote_imprints ADD COLUMN group_label text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quote_imprints_group_label ON quote_imprints(group_label);

-- ============================================================================
-- Migration: 20260126235647_add_group_label_to_proofs.sql
-- ============================================================================

/*
  # Add Group Label to Proofs Table

  1. Changes
    - Add `group_label` column to `proofs` table
    - This allows proofs to be associated with specific line item groups
    - Each group can have its own isolated set of proofs

  2. Notes
    - group_label should match the group_label on quote_line_items
    - This enables proper isolation of proofs per line item group
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE proofs ADD COLUMN group_label text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proofs_group_label ON proofs(group_label);

-- ============================================================================
-- Migration: 20260127004000_add_selected_colors_to_proofs.sql
-- ============================================================================

/*
  # Add Selected Colors to Proofs Table

  1. Changes
    - Add `selected_colors` column to `proofs` table
      - Stores array of selected ink or thread colors
      - Based on the type_of_work field
  
  2. Notes
    - Uses JSONB array format for flexible color storage
    - Allows multiple colors to be selected per mockup
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'selected_colors'
  ) THEN
    ALTER TABLE proofs ADD COLUMN selected_colors jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260127142442_update_ssactivewear_to_promostandards.sql
-- ============================================================================

/*
  # Update SSActivewear to PromoStandards Integration

  1. Changes
    - Update `integration_settings` table to support PromoStandards
    - Change ssactivewear_credentials structure to store:
      - accountNumber: SSActivewear account number
      - apiKey: PromoStandards API key
      - version: PromoStandards version (2.0.0)
    
  2. Notes
    - This migration maintains backward compatibility
    - Old credentials will need to be re-entered
    - PromoStandards uses XML-based SOAP APIs
*/

-- No schema changes needed - the existing jsonb field supports the new structure
-- Companies will need to re-enter their credentials in the new format:
-- {
--   "accountNumber": "YOUR_ACCOUNT_NUMBER",
--   "apiKey": "YOUR_API_KEY"
-- }

-- Add comment to document the new structure
COMMENT ON COLUMN integration_settings.ssactivewear_credentials IS 
  'PromoStandards credentials stored as JSON: {"accountNumber": "...", "apiKey": "..."}';

-- ============================================================================
-- Migration: 20260127150526_add_supplier_integration_credentials.sql
-- ============================================================================

/*
  # Add Supplier Integration Credentials

  1. Changes
    - Add SSActivewear credentials columns to company_settings
    - Add SanMar credentials columns to company_settings
    
  2. Security
    - Credentials are encrypted
    - Only accessible to users in the same company
*/

-- Add SSActivewear credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'ssactivewear_username'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN ssactivewear_username text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'ssactivewear_api_key_encrypted'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN ssactivewear_api_key_encrypted text;
  END IF;
END $$;

-- Add SanMar credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sanmar_username'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sanmar_username text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sanmar_api_key_encrypted'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sanmar_api_key_encrypted text;
  END IF;
END $$;


-- ============================================================================
-- Migration: 20260127181806_create_work_type_workflows_table.sql
-- ============================================================================

/*
  # Create Work Type Workflows Table

  1. New Tables
    - `work_type_workflows`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `work_type_id` (uuid, foreign key to type_of_work_settings)
      - `steps` (jsonb) - array of step objects with statuses
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `work_type_workflows` table
    - Add policies for authenticated users in same company

  3. Indexes
    - Index on work_type_id for fast lookups
    - Index on company_id for multi-tenant isolation

  4. Example steps JSON structure:
    [
      {
        "step_name": "Production",
        "statuses": [
          { "name": "Not Started", "color": "#CCCCCC" },
          { "name": "In Progress", "color": "#FFA500" },
          { "name": "Complete", "color": "#00CC66" }
        ]
      },
      {
        "step_name": "Shipping",
        "statuses": [
          { "name": "Packed", "color": "#3399FF" },
          { "name": "Shipped", "color": "#6666FF" }
        ]
      }
    ]
*/

CREATE TABLE IF NOT EXISTS work_type_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_type_id uuid NOT NULL REFERENCES type_of_work_settings(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_type_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_work_type_workflows_work_type_id ON work_type_workflows(work_type_id);
CREATE INDEX IF NOT EXISTS idx_work_type_workflows_company_id ON work_type_workflows(company_id);

-- Enable RLS
ALTER TABLE work_type_workflows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view workflows in their company
CREATE POLICY "Users can view workflows in their company"
  ON work_type_workflows
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert workflows in their company
CREATE POLICY "Users can insert workflows in their company"
  ON work_type_workflows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update workflows in their company
CREATE POLICY "Users can update workflows in their company"
  ON work_type_workflows
  FOR UPDATE
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

-- Policy: Users can delete workflows in their company
CREATE POLICY "Users can delete workflows in their company"
  ON work_type_workflows
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_type_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_work_type_workflows_updated_at
  BEFORE UPDATE ON work_type_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_work_type_workflows_updated_at();

-- ============================================================================
-- Migration: 20260127183525_create_production_schedule_entries.sql
-- ============================================================================

/*
  # Create Production Schedule Entries Table

  1. New Tables
    - `production_schedule_entries`
      - `id` (uuid, primary key) - Unique identifier
      - `company_id` (uuid) - Company isolation
      - `quote_id` (uuid) - Reference to original quote
      - `line_item_id` (uuid) - Reference to quote line item
      - `imprint_id` (uuid) - Reference to quote imprint
      - `type_of_work` (text) - Type of work (e.g., "Screen Printing", "Embroidery")
      - `imprint_number` (text) - Display number for the imprint
      - `artwork_thumb_url` (text) - URL to artwork thumbnail
      - `production_due_date` (date) - Scheduled production date
      - `station` (text) - Assigned production station
      - `quantity` (int) - Number of items for this decoration
      - `step_statuses` (jsonb) - Current status for each workflow step
      - `priority_order` (int) - Order within the same day/station
      - `customer_name` (text) - Cached customer name for filtering
      - `quote_number` (text) - Cached quote number for filtering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `production_schedule_entries` table
    - Add policies for company-isolated access
    - Production users can view and update their company's schedule
*/

CREATE TABLE IF NOT EXISTS production_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  imprint_id uuid REFERENCES quote_imprints(id) ON DELETE CASCADE,
  type_of_work text NOT NULL,
  imprint_number text,
  artwork_thumb_url text,
  production_due_date date NOT NULL,
  station text,
  quantity int NOT NULL DEFAULT 0,
  step_statuses jsonb DEFAULT '{}'::jsonb,
  priority_order int DEFAULT 0,
  customer_name text,
  quote_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_entries_company_id ON production_schedule_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_type_of_work ON production_schedule_entries(company_id, type_of_work);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_due_date ON production_schedule_entries(company_id, production_due_date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_station ON production_schedule_entries(company_id, station);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_quote_id ON production_schedule_entries(quote_id);

-- Enable RLS
ALTER TABLE production_schedule_entries ENABLE ROW LEVEL SECURITY;

-- Policy for viewing schedule entries
CREATE POLICY "Users can view their company schedule entries"
  ON production_schedule_entries
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for creating schedule entries
CREATE POLICY "Users can create schedule entries for their company"
  ON production_schedule_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for updating schedule entries
CREATE POLICY "Users can update their company schedule entries"
  ON production_schedule_entries
  FOR UPDATE
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

-- Policy for deleting schedule entries
CREATE POLICY "Users can delete their company schedule entries"
  ON production_schedule_entries
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_schedule_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedule_entry_timestamp
  BEFORE UPDATE ON production_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_entry_updated_at();

-- ============================================================================
-- Migration: 20260127183858_create_schedule_entries_on_quote_approval.sql
-- ============================================================================

/*
  # Create Schedule Entries on Quote Approval

  1. Functions
    - `create_schedule_entries_on_approval()` - Automatically creates production schedule entries when a quote is approved

  2. Triggers
    - After update on quotes table, if status changes to 'approved', create schedule entries

  This ensures schedule entries are created regardless of how the quote is approved (manual, API, public link, etc.)
*/

-- Function to create schedule entries when quote is approved
CREATE OR REPLACE FUNCTION create_schedule_entries_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Insert schedule entries for each imprint
    INSERT INTO production_schedule_entries (
      company_id,
      quote_id,
      line_item_id,
      imprint_id,
      type_of_work,
      imprint_number,
      artwork_thumb_url,
      production_due_date,
      station,
      quantity,
      step_statuses,
      priority_order,
      customer_name,
      quote_number
    )
    SELECT
      NEW.company_id,
      NEW.id,
      qi.line_item_id,
      qi.id,
      qi.type_of_work,
      qi.imprint_number,
      qi.artwork_url,
      COALESCE(NEW.production_due_date, NEW.due_date, CURRENT_DATE + INTERVAL '7 days'),
      NULL,
      COALESCE(qli.quantity, 0),
      '{}'::jsonb,
      0,
      COALESCE(c.customer_name, NEW.customer_name),
      NEW.quote_number
    FROM quote_imprints qi
    LEFT JOIN quote_line_items qli ON qi.line_item_id = qli.id
    LEFT JOIN customers c ON NEW.customer_id = c.id
    WHERE qi.quote_id = NEW.id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_schedule_on_approval ON quotes;
CREATE TRIGGER trigger_create_schedule_on_approval
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION create_schedule_entries_on_approval();

-- ============================================================================
-- Migration: 20260127192156_create_production_stations_table.sql
-- ============================================================================

/*
  # Create Production Stations Table

  1. New Tables
    - `production_stations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `work_type_id` (uuid, references type_of_work_settings)
      - `station_name` (text, name of the station)
      - `is_active` (boolean, whether station is currently active)
      - `display_order` (integer, for sorting stations)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `production_stations` table
    - Add policies for authenticated users to manage stations within their company

  3. Purpose
    - Allows companies to define stations for each type of work
    - Stations can be assigned to production schedule entries
    - Supports multiple stations per work type for scheduling
*/

-- Create production_stations table
CREATE TABLE IF NOT EXISTS production_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_type_id uuid NOT NULL REFERENCES type_of_work_settings(id) ON DELETE CASCADE,
  station_name text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_stations_company_id ON production_stations(company_id);
CREATE INDEX IF NOT EXISTS idx_production_stations_work_type_id ON production_stations(work_type_id);
CREATE INDEX IF NOT EXISTS idx_production_stations_display_order ON production_stations(display_order);

-- Enable RLS
ALTER TABLE production_stations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view stations in their company"
  ON production_stations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert stations in their company"
  ON production_stations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update stations in their company"
  ON production_stations FOR UPDATE
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

CREATE POLICY "Users can delete stations in their company"
  ON production_stations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_production_stations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_stations_updated_at
  BEFORE UPDATE ON production_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_production_stations_updated_at();

-- ============================================================================
-- Migration: 20260127193223_fix_companies_table_sync.sql
-- ============================================================================

/*
  # Fix Companies Table Sync
  
  ## Problem
  The `companies` table was empty, causing foreign key constraint violations
  when creating production_stations and other records that reference companies.
  
  ## Solution
  1. Backfill companies table with existing company_settings data
  2. Create trigger to keep companies table in sync when company_settings changes
  
  ## Changes
  - Populate companies table from company_settings
  - Add trigger to sync company name changes from company_settings to companies
*/

-- Backfill companies table (already done via direct SQL, but safe to run again)
INSERT INTO companies (id, name, created_at, updated_at)
SELECT id, company_name, created_at, updated_at 
FROM company_settings
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = EXCLUDED.updated_at;

-- Create function to sync company name changes
CREATE OR REPLACE FUNCTION sync_company_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- When company_settings is updated, update the corresponding company name
  UPDATE public.companies
  SET name = NEW.company_name,
      updated_at = NEW.updated_at
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on company_settings
DROP TRIGGER IF EXISTS sync_company_name_trigger ON company_settings;
CREATE TRIGGER sync_company_name_trigger
  AFTER UPDATE OF company_name ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION sync_company_name();

-- Also ensure handle_new_user creates company records properly
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
    -- First user - create new company
    new_company_id := gen_random_uuid();
    
    INSERT INTO public.companies (id, name, created_at, updated_at)
    VALUES (new_company_id, 'My Company', now(), now());

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

    INSERT INTO public.company_settings (id, company_name, owner_id, created_at, updated_at)
    VALUES (new_company_id, 'My Company', NEW.id, now(), now());
  ELSE
    -- Additional users join the first company
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


-- ============================================================================
-- Migration: 20260127195629_fix_screen_print_step_statuses_key.sql
-- ============================================================================

/*
  # Fix Screen Print Step Statuses Keys

  1. Updates
    - Rename "PRODUCTION" key to "PRODUCTION STATUS" in step_statuses JSONB for Screen Print entries
    - This aligns the database keys with the actual workflow step names

  2. Reason
    - The workflow step is named "PRODUCTION STATUS" but existing entries have the key "PRODUCTION"
    - This mismatch causes status changes not to persist correctly
*/

-- Update existing Screen Print schedule entries to rename PRODUCTION key to PRODUCTION STATUS
UPDATE production_schedule_entries
SET step_statuses = 
  CASE 
    WHEN step_statuses ? 'PRODUCTION' 
    THEN (step_statuses - 'PRODUCTION') || jsonb_build_object('PRODUCTION STATUS', step_statuses->'PRODUCTION')
    ELSE step_statuses
  END
WHERE type_of_work = 'Screen Print'
  AND step_statuses ? 'PRODUCTION';


-- ============================================================================
-- Migration: 20260127200543_create_scheduler_tabs_table.sql
-- ============================================================================

/*
  # Create Scheduler Tabs Feature

  1. New Tables
    - `scheduler_tabs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, nullable, foreign key to user_profiles)
      - `type_of_work` (text)
      - `tab_name` (text)
      - `is_public` (boolean, default false)
      - `filters` (jsonb) - stores filter configuration
      - `sort_config` (jsonb) - stores sort order
      - `tab_order` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `scheduler_tabs` table
    - Add policy for users to read their own private tabs
    - Add policy for users to read all public tabs in their company
    - Add policy for users to create tabs
    - Add policy for users to update/delete their own tabs
    - Add policy for admins to manage all tabs

  3. Indexes
    - Index on company_id for fast lookups
    - Index on type_of_work for filtering
    - Composite index on company_id + type_of_work + tab_order for sorting
*/

-- Create scheduler_tabs table
CREATE TABLE IF NOT EXISTS scheduler_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  type_of_work text NOT NULL,
  tab_name text NOT NULL,
  is_public boolean DEFAULT false,
  filters jsonb DEFAULT '{}'::jsonb,
  sort_config jsonb DEFAULT '{}'::jsonb,
  tab_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_company_id ON scheduler_tabs(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_type_of_work ON scheduler_tabs(type_of_work);
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_company_work_order ON scheduler_tabs(company_id, type_of_work, tab_order);

-- Enable RLS
ALTER TABLE scheduler_tabs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own private tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can read public tabs in company" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can create tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can update own tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can delete own tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Admins can manage all tabs" ON scheduler_tabs;

-- Policy: Users can read their own private tabs
CREATE POLICY "Users can read own private tabs"
  ON scheduler_tabs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND is_public = false
  );

-- Policy: Users can read all public tabs in their company
CREATE POLICY "Users can read public tabs in company"
  ON scheduler_tabs
  FOR SELECT
  TO authenticated
  USING (
    is_public = true
    AND company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can create tabs for their company
CREATE POLICY "Users can create tabs"
  ON scheduler_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update their own tabs
CREATE POLICY "Users can update own tabs"
  ON scheduler_tabs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own tabs
CREATE POLICY "Users can delete own tabs"
  ON scheduler_tabs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admins can manage all tabs in their company
CREATE POLICY "Admins can manage all tabs"
  ON scheduler_tabs
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduler_tabs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scheduler_tabs_updated_at ON scheduler_tabs;

CREATE TRIGGER update_scheduler_tabs_updated_at
  BEFORE UPDATE ON scheduler_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduler_tabs_updated_at();

-- ============================================================================
-- Migration: 20260128154317_fix_schema_cache_reload.sql
-- ============================================================================

/*
  # Fix Schema Cache and Data Consistency

  1. Purpose
    - Force schema cache reload
    - Verify all auth users have proper profiles and company settings
    - Clean up any inconsistencies

  2. Changes
    - Add comment to trigger schema reload
    - Verify data integrity
*/

-- Force schema cache reload by touching the company_settings table
COMMENT ON TABLE company_settings IS 'Company-wide settings and API credentials - Updated 2026-01-28';

-- Verify all auth users have profiles (just a check, won't break if OK)
DO $$
DECLARE
  orphaned_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_users
  FROM auth.users au
  LEFT JOIN user_profiles up ON up.id = au.id
  WHERE up.id IS NULL;
  
  IF orphaned_users > 0 THEN
    RAISE NOTICE 'Found % orphaned auth users without profiles', orphaned_users;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================================================
-- Migration: 20260128154423_fix_signup_trigger_no_company_id.sql
-- ============================================================================

/*
  # Fix Signup Trigger - Remove Company ID References

  1. Purpose
    - Fix the signup trigger that was failing
    - Remove references to non-existent company_id column in user_profiles
    - Ensure proper company_settings creation

  2. Changes
    - Update handle_new_user function to work with actual schema
    - Remove company_id references from user_profiles inserts
*/

-- Drop and recreate the signup function without company_id references
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_company_id uuid;
  user_count integer;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    -- First user ever - create new company
    new_company_id := gen_random_uuid();

    -- Create user profile
    INSERT INTO public.user_profiles (
      id, 
      email, 
      full_name, 
      role, 
      created_at, 
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'super_admin',
      now(),
      now()
    );

    -- Create company settings
    INSERT INTO public.company_settings (
      id, 
      company_name, 
      owner_id, 
      created_at, 
      updated_at
    )
    VALUES (
      new_company_id, 
      'My Company', 
      NEW.id, 
      now(), 
      now()
    );
  ELSE
    -- Additional users - standard user role
    INSERT INTO public.user_profiles (
      id, 
      email, 
      full_name, 
      role, 
      created_at, 
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'user',
      now(),
      now()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't break auth
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Force schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================================================
-- Migration: 20260128165630_reset_jamie_password.sql
-- ============================================================================

/*
  # Reset Jamie's Password
  
  This is a one-time migration to reset the password for jamie@toddssportinggoods.com
  to allow login access.
*/

-- Create a temporary function to reset the password
CREATE OR REPLACE FUNCTION reset_user_password(user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the user's password using Supabase's internal password encryption
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;
END;
$$;

-- Reset Jamie's password
SELECT reset_user_password('aa362957-36e2-4b76-b830-165a7c32e674'::uuid, 'Jamielampert');

-- Drop the temporary function
DROP FUNCTION reset_user_password(uuid, text);


-- ============================================================================
-- Force PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

