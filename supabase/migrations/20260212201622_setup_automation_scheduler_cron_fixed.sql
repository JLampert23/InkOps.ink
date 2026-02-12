/*
  # Setup Automation Scheduler Cron Job

  1. Cron Jobs
    - Schedule automation-scheduler to run every 5 minutes
    - Processes time-based triggers and resumes paused automations

  2. Purpose
    - Process scheduled_datetime_trigger automations when their time arrives
    - Process recurring_schedule_trigger automations (daily, weekly, monthly, hourly)
    - Resume paused automations waiting on wait_duration or wait_until actions
    - Does NOT process time_delay_trigger (handled by queue system)

  3. Notes
    - Runs every 5 minutes to catch scheduled events
    - Uses environment variables for URL and key
*/

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Remove existing schedule if it exists
SELECT cron.unschedule('automation-scheduler-worker')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'automation-scheduler-worker'
);

-- Schedule automation scheduler to run every 5 minutes
-- Note: In Supabase, we need to use the net extension to call edge functions
-- The URL and service role key are stored in vault or environment variables
SELECT cron.schedule(
  'automation-scheduler-worker',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT COALESCE(current_setting('app.supabase_url', true), 'https://placeholder.supabase.co')) || '/functions/v1/automation-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT COALESCE(current_setting('app.service_role_key', true), 'placeholder'))
      ),
      body := jsonb_build_object(
        'triggered_by', 'cron',
        'executed_at', now()
      )
    ) AS request_id;
  $$
);