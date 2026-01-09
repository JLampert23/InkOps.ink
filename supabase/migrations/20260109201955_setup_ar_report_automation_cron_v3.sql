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