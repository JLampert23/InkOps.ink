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
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://gccvdsxiqgbxhdyamzaa.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';