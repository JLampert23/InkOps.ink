/*
  # Fix process_automated_reports to Use user_id
  
  1. Changes
    - Update all INSERT statements to use user_id instead of company_id
    - Get user_id from automated_reports table
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
  scheduled_time_utc timestamptz;
  now_in_rule_tz timestamptz;
  last_sent_in_rule_tz date;
  today_in_rule_tz date;
  minutes_since_scheduled numeric;
  within_window boolean;
  already_sent_today boolean;
  should_send boolean;
  skip_reason text;
BEGIN
  -- Get config for Supabase connection
  SELECT supabase_url, supabase_anon_key INTO config_record
  FROM printavo_sync_config
  LIMIT 1;
  
  IF config_record IS NULL THEN
    RAISE NOTICE 'Supabase config not found, skipping automated reports';
    RETURN;
  END IF;
  
  -- Get current time
  now_utc := CURRENT_TIMESTAMP;
  
  -- Loop through all enabled automation rules
  FOR rule_record IN 
    SELECT * FROM automated_reports 
    WHERE is_enabled = true
  LOOP
    -- Reset flags for this rule
    should_send := false;
    skip_reason := NULL;
    
    -- Calculate scheduled time in UTC for today
    scheduled_time_utc := (CURRENT_DATE || ' ' || rule_record.schedule_time)::timestamp 
                          AT TIME ZONE rule_record.schedule_timezone 
                          AT TIME ZONE 'UTC';
    
    -- Calculate current time and last sent time in the rule's timezone
    now_in_rule_tz := now_utc AT TIME ZONE rule_record.schedule_timezone;
    today_in_rule_tz := DATE(now_in_rule_tz);
    
    IF rule_record.last_sent_at IS NOT NULL THEN
      last_sent_in_rule_tz := DATE(rule_record.last_sent_at AT TIME ZONE rule_record.schedule_timezone);
    ELSE
      last_sent_in_rule_tz := NULL;
    END IF;
    
    -- Calculate minutes since scheduled time
    minutes_since_scheduled := EXTRACT(EPOCH FROM (now_utc - scheduled_time_utc))/60;
    
    -- Check if we're within the 2-hour window after scheduled time
    within_window := (now_utc >= scheduled_time_utc AND now_utc < scheduled_time_utc + INTERVAL '2 hours');
    
    -- Check if already sent today (in the rule's timezone)
    already_sent_today := (last_sent_in_rule_tz IS NOT NULL AND last_sent_in_rule_tz >= today_in_rule_tz);
    
    -- Determine if we should send based on schedule type
    IF already_sent_today THEN
      skip_reason := 'Already sent today in timezone ' || rule_record.schedule_timezone;
    ELSIF now_utc < scheduled_time_utc THEN
      skip_reason := 'Scheduled time has not arrived yet (scheduled for ' || scheduled_time_utc::text || ')';
    ELSE
      -- Past scheduled time and not sent today - check schedule type
      CASE rule_record.schedule_type
        WHEN 'daily' THEN
          -- Daily reports: send if not sent today and past scheduled time
          should_send := true;
          
        WHEN 'weekly' THEN
          -- Weekly reports: send if correct day of week and not sent today
          IF EXTRACT(DOW FROM now_in_rule_tz)::int = rule_record.schedule_day_of_week THEN
            should_send := true;
          ELSE
            skip_reason := 'Not the correct day of week (today: ' || EXTRACT(DOW FROM now_in_rule_tz)::text || ', scheduled: ' || COALESCE(rule_record.schedule_day_of_week::text, 'NULL') || ')';
          END IF;
          
        WHEN 'monthly' THEN
          -- Monthly reports: send if correct day of month and not sent today
          IF EXTRACT(DAY FROM now_in_rule_tz)::int = rule_record.schedule_day_of_month THEN
            should_send := true;
          ELSE
            skip_reason := 'Not the correct day of month (today: ' || EXTRACT(DAY FROM now_in_rule_tz)::text || ', scheduled: ' || COALESCE(rule_record.schedule_day_of_month::text, 'NULL') || ')';
          END IF;
          
        ELSE
          skip_reason := 'Unknown schedule type: ' || COALESCE(rule_record.schedule_type, 'NULL');
      END CASE;
    END IF;
    
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
        
        -- Log successful execution
        INSERT INTO automated_reports_execution_log (
          user_id,
          report_id,
          executed_at,
          scheduled_time_local,
          scheduled_time_utc,
          actual_execution_time_utc,
          timezone,
          was_sent,
          skip_reason,
          within_time_window,
          already_sent_today,
          minutes_since_scheduled,
          success,
          edge_function_request_id
        ) VALUES (
          rule_record.user_id,
          rule_record.id,
          now_utc,
          rule_record.schedule_time,
          scheduled_time_utc,
          now_utc,
          rule_record.schedule_timezone,
          true,
          NULL,
          within_window,
          already_sent_today,
          minutes_since_scheduled,
          true,
          request_id
        );
        
        RAISE NOTICE 'Automated report sent for rule %: % (request_id: %)', 
          rule_record.id, rule_record.report_name, request_id;
        
      EXCEPTION WHEN OTHERS THEN
        -- Log failed execution
        INSERT INTO automated_reports_execution_log (
          user_id,
          report_id,
          executed_at,
          scheduled_time_local,
          scheduled_time_utc,
          actual_execution_time_utc,
          timezone,
          was_sent,
          skip_reason,
          within_time_window,
          already_sent_today,
          minutes_since_scheduled,
          success,
          error_message
        ) VALUES (
          rule_record.user_id,
          rule_record.id,
          now_utc,
          rule_record.schedule_time,
          scheduled_time_utc,
          now_utc,
          rule_record.schedule_timezone,
          false,
          'Failed to call edge function',
          within_window,
          already_sent_today,
          minutes_since_scheduled,
          false,
          SQLERRM
        );
        
        RAISE NOTICE 'Failed to send report for rule %: %', rule_record.id, SQLERRM;
      END;
    ELSE
      -- Log skipped execution with reason
      INSERT INTO automated_reports_execution_log (
        user_id,
        report_id,
        executed_at,
        scheduled_time_local,
        scheduled_time_utc,
        actual_execution_time_utc,
        timezone,
        was_sent,
        skip_reason,
        within_time_window,
        already_sent_today,
        minutes_since_scheduled,
        success
      ) VALUES (
        rule_record.user_id,
        rule_record.id,
        now_utc,
        rule_record.schedule_time,
        scheduled_time_utc,
        now_utc,
        rule_record.schedule_timezone,
        false,
        skip_reason,
        within_window,
        already_sent_today,
        minutes_since_scheduled,
        true
      );
    END IF;
  END LOOP;
END;
$$;
