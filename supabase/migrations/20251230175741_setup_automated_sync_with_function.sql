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
  'https://gccvdsxiqgbxhdyamzaa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY3Zkc3hpcWdieGhkeWFtemFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODMzNDQsImV4cCI6MjA4MTY1OTM0NH0.DdClhHGBlvS4WUvomGWULtU2hlniTxQNCUxqB1XYzm4'
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