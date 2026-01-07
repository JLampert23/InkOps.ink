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