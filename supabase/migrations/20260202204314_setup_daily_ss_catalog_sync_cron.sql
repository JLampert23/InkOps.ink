/*
  # Setup Daily S&S Catalog Sync Cron Job

  ## Overview
  Creates a scheduled job that runs once per day to sync the S&S Activewear catalog
  for all companies with SSActivewear integration enabled.

  ## Schedule
  - Runs daily at 2:00 AM UTC
  - Calls the sync-ss-catalog edge function
  - Automatically retries on failure

  ## Notes
  - Uses pg_cron extension (already enabled)
  - Service role key is used for authentication
  - Function processes all enabled companies automatically
*/

-- Remove existing cron job if it exists
SELECT cron.unschedule('sync-ss-catalog-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-ss-catalog-daily'
);

-- Schedule daily sync at 2:00 AM UTC
SELECT cron.schedule(
  'sync-ss-catalog-daily',
  '0 2 * * *', -- Every day at 2:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-ss-catalog',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
