/*
  # Setup Automation Cron Jobs
  
  1. Cron Jobs
    - Process automation queue every 5 minutes
    - Check for overdue invoices daily
    - Process scheduled automations every hour
  
  2. Functions
    - Helper functions for scheduled triggers
*/

-- Function to process the automation queue via cron
CREATE OR REPLACE FUNCTION cron_process_automation_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response text;
BEGIN
  -- Call the edge function via pg_net
  SELECT 
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/process-automation-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    )::text INTO v_response;
  
  RAISE NOTICE 'Automation queue processed: %', v_response;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error processing automation queue: %', SQLERRM;
END;
$$;

-- Function to check for overdue invoices and trigger automations
CREATE OR REPLACE FUNCTION cron_check_overdue_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice RECORD;
  v_company_id uuid;
BEGIN
  -- Get company_id (assuming single company for now)
  SELECT id INTO v_company_id FROM company_settings LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Find all overdue invoices
  FOR v_invoice IN
    SELECT 
      id,
      invoice_number,
      customer_name,
      customer_email,
      total,
      amount_outstanding,
      due_date,
      status
    FROM printavo_invoices
    WHERE due_date < CURRENT_DATE
      AND status NOT IN ('paid', 'cancelled', 'void')
      AND amount_outstanding > 0
  LOOP
    -- Queue automation for each overdue invoice
    PERFORM queue_matching_automations(
      v_company_id,
      'invoice_overdue',
      jsonb_build_object(
        'invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'customer_name', v_invoice.customer_name,
        'customer_email', v_invoice.customer_email,
        'amount_due', v_invoice.amount_outstanding,
        'due_date', v_invoice.due_date,
        'days_overdue', CURRENT_DATE - v_invoice.due_date::date
      )
    );
  END LOOP;
  
  RAISE NOTICE 'Checked for overdue invoices';
END;
$$;

-- Function to process scheduled/recurring automations
CREATE OR REPLACE FUNCTION cron_process_scheduled_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_automation RECORD;
  v_next_run timestamptz;
BEGIN
  -- Process time_delay_trigger automations (these are queued by other events)
  -- Nothing to do here, they're handled by the queue processor
  
  -- Process scheduled_datetime_trigger automations
  FOR v_automation IN
    SELECT *
    FROM automations
    WHERE trigger_type = 'scheduled_datetime_trigger'
      AND is_enabled = true
      AND (scheduling->>'scheduled_datetime')::timestamptz <= now()
      AND (
        scheduling->>'last_run' IS NULL 
        OR (scheduling->>'scheduled_datetime')::timestamptz > (scheduling->>'last_run')::timestamptz
      )
  LOOP
    -- Queue the automation
    PERFORM queue_automation_execution(
      v_automation.id,
      v_automation.trigger_type,
      jsonb_build_object(
        'scheduled_time', v_automation.scheduling->>'scheduled_datetime',
        'automation_name', v_automation.name
      )
    );
    
    -- Update last run time
    UPDATE automations
    SET scheduling = jsonb_set(
      scheduling,
      '{last_run}',
      to_jsonb(now()::text)
    )
    WHERE id = v_automation.id;
  END LOOP;
  
  -- Process recurring_schedule_trigger automations
  FOR v_automation IN
    SELECT *
    FROM automations
    WHERE trigger_type = 'recurring_schedule_trigger'
      AND is_enabled = true
  LOOP
    -- Calculate if it's time to run based on recurrence pattern
    v_next_run := calculate_next_run(
      v_automation.scheduling->>'last_run',
      v_automation.scheduling->>'recurrence_pattern',
      v_automation.scheduling->>'recurrence_interval'
    );
    
    IF v_next_run IS NOT NULL AND v_next_run <= now() THEN
      -- Queue the automation
      PERFORM queue_automation_execution(
        v_automation.id,
        v_automation.trigger_type,
        jsonb_build_object(
          'scheduled_time', v_next_run,
          'automation_name', v_automation.name,
          'recurrence_pattern', v_automation.scheduling->>'recurrence_pattern'
        )
      );
      
      -- Update last run time
      UPDATE automations
      SET scheduling = jsonb_set(
        scheduling,
        '{last_run}',
        to_jsonb(now()::text)
      )
      WHERE id = v_automation.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Processed scheduled automations';
END;
$$;

-- Helper function to calculate next run time for recurring automations
CREATE OR REPLACE FUNCTION calculate_next_run(
  last_run_text text,
  recurrence_pattern text,
  recurrence_interval text
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  last_run timestamptz;
  interval_value integer;
  next_run timestamptz;
BEGIN
  -- Parse last run time
  IF last_run_text IS NULL OR last_run_text = '' THEN
    RETURN now(); -- First run
  END IF;
  
  last_run := last_run_text::timestamptz;
  interval_value := COALESCE(recurrence_interval::integer, 1);
  
  -- Calculate next run based on pattern
  CASE recurrence_pattern
    WHEN 'daily' THEN
      next_run := last_run + (interval_value || ' days')::interval;
    WHEN 'weekly' THEN
      next_run := last_run + (interval_value || ' weeks')::interval;
    WHEN 'monthly' THEN
      next_run := last_run + (interval_value || ' months')::interval;
    WHEN 'hourly' THEN
      next_run := last_run + (interval_value || ' hours')::interval;
    ELSE
      RETURN NULL;
  END CASE;
  
  RETURN next_run;
END;
$$;

-- Schedule cron jobs using pg_cron
-- Note: pg_cron must be enabled in Supabase dashboard

-- Process automation queue every 5 minutes
SELECT cron.schedule(
  'process-automation-queue',
  '*/5 * * * *',
  $$SELECT cron_process_automation_queue()$$
);

-- Check for overdue invoices daily at 9 AM
SELECT cron.schedule(
  'check-overdue-invoices',
  '0 9 * * *',
  $$SELECT cron_check_overdue_invoices()$$
);

-- Process scheduled automations every hour
SELECT cron.schedule(
  'process-scheduled-automations',
  '0 * * * *',
  $$SELECT cron_process_scheduled_automations()$$
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION cron_process_automation_queue TO authenticated;
GRANT EXECUTE ON FUNCTION cron_check_overdue_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION cron_process_scheduled_automations TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_next_run TO authenticated;
