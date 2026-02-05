/*
  # Setup SanMar FTP Sync Cron Jobs

  1. Cron Jobs
    - Full catalog sync: Runs nightly at 2 AM
    - Inventory-only sync: Runs hourly during business hours (8 AM - 8 PM)

  2. Notes
    - Uses pg_cron extension to schedule automatic syncs
    - Calls sanmar-ftp-sync edge function for each enabled company
    - Full sync downloads and processes all catalog files
    - Inventory sync only updates inventory and pricing from DIP file
*/

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to trigger SanMar sync for all companies with SanMar enabled
CREATE OR REPLACE FUNCTION trigger_sanmar_full_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_record RECORD;
  function_url text;
  service_key text;
BEGIN
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/sanmar-ftp-sync';
  service_key := current_setting('app.supabase_service_role_key', true);

  FOR company_record IN
    SELECT id
    FROM companies c
    WHERE EXISTS (
      SELECT 1
      FROM company_settings cs
      WHERE cs.id = c.id
        AND cs.sanmar_enabled = true
        AND cs.sanmar_username IS NOT NULL
        AND cs.sanmar_password_encrypted IS NOT NULL
    )
  LOOP
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'companyId', company_record.id,
        'syncType', 'full'
      )
    );

    RAISE NOTICE 'Triggered full SanMar sync for company %', company_record.id;
  END LOOP;
END;
$$;

-- Create a function to trigger inventory-only sync
CREATE OR REPLACE FUNCTION trigger_sanmar_inventory_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_record RECORD;
  function_url text;
  service_key text;
BEGIN
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/sanmar-ftp-sync';
  service_key := current_setting('app.supabase_service_role_key', true);

  FOR company_record IN
    SELECT id
    FROM companies c
    WHERE EXISTS (
      SELECT 1
      FROM company_settings cs
      WHERE cs.id = c.id
        AND cs.sanmar_enabled = true
        AND cs.sanmar_username IS NOT NULL
        AND cs.sanmar_password_encrypted IS NOT NULL
    )
  LOOP
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'companyId', company_record.id,
        'syncType', 'inventory'
      )
    );

    RAISE NOTICE 'Triggered inventory sync for company %', company_record.id;
  END LOOP;
END;
$$;

-- Schedule full catalog sync nightly at 2 AM
SELECT cron.schedule(
  'sanmar-full-sync-nightly',
  '0 2 * * *',
  'SELECT trigger_sanmar_full_sync();'
);

-- Schedule inventory sync every hour during business hours (8 AM - 8 PM)
SELECT cron.schedule(
  'sanmar-inventory-sync-hourly',
  '0 8-20 * * *',
  'SELECT trigger_sanmar_inventory_sync();'
);

-- View active cron jobs
COMMENT ON FUNCTION trigger_sanmar_full_sync() IS 'Triggers full SanMar catalog sync for all enabled companies';
COMMENT ON FUNCTION trigger_sanmar_inventory_sync() IS 'Triggers inventory-only sync for all enabled companies';
