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
