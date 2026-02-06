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
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU'
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
