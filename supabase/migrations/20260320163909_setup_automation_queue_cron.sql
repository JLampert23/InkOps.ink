/*
  # Setup Automation Queue Processing Cron Job

  1. Purpose
    - Process pending automation events every minute
    - Ensure automations are executed promptly after status changes

  2. Changes
    - Create cron job to call process-automation-queue edge function
    - Schedule to run every minute
*/

-- First, unschedule if it exists
SELECT cron.unschedule('process-automation-queue');

-- Create cron job to process automation queue every minute
SELECT cron.schedule(
  job_name := 'process-automation-queue',
  schedule := '* * * * *', -- Every minute
  command := $$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/process-automation-queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
        ),
        body := '{}'::jsonb
      ) as request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Processes automation queue every minute to execute pending automations';
