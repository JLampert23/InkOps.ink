/*
  # Fix Automation Cron Job to Call Edge Function
  
  1. Purpose
    - Enable automatic email sending through the automation queue
    - Configure the cron job to call the Edge Function instead of SQL function
  
  2. Changes
    - Update cron job to use net.http_post to call the process-automation-queue Edge Function
    - Hard-code the credentials in the cron job (they're already in the .env file)
    - This allows the cron job to actually send emails, SMS, and execute other actions
  
  3. Important Notes
    - The Edge Function process-automation-queue already exists and is deployed
    - Queue items are already being created properly
    - This fix enables the final step: automatic execution of queued automations
*/

-- Update the cron job to call the Edge Function via HTTP
SELECT cron.unschedule('process-automation-queue');

SELECT cron.schedule(
  job_name := 'process-automation-queue',
  schedule := '* * * * *', -- Every minute
  command := $$
    SELECT
      net.http_post(
        url := 'https://cuaukcvccxvfpuxaciac.supabase.co/functions/v1/process-automation-queue',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjU2MDg1NCwiZXhwIjoyMDgyMTM2ODU0fQ.IcMUmLiTbVWUt-HfHH6f2KEJuZ2IlHRb9iLPvRe4I5s'
        ),
        body := '{}'::jsonb
      ) as request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Processes automation queue every minute by calling Edge Function to execute pending automations including emails and SMS';
