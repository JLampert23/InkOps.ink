/*
  # Create Auto-Approval Background Job for Quotes

  1. Purpose
    - Auto-approve quotes after X days if configured
    - Auto-expire quotes past their valid_until date
    - Run daily to check and process approvals

  2. Implementation
    - Create function to process auto-approvals
    - Create function to expire old quotes
    - Set up pg_cron job to run daily
*/

-- Function to auto-approve quotes based on auto_approve_after_days
CREATE OR REPLACE FUNCTION process_quote_auto_approvals()
RETURNS void AS $$
DECLARE
  v_approval RECORD;
  v_auto_approve_date timestamptz;
BEGIN
  -- Loop through approvals with auto_approve_after_days set
  FOR v_approval IN
    SELECT 
      qa.id,
      qa.quote_id,
      qa.company_id,
      qa.auto_approve_after_days,
      qa.created_at,
      q.status
    FROM quote_approvals qa
    JOIN quotes q ON q.id = qa.quote_id
    WHERE qa.auto_approve_after_days IS NOT NULL
      AND qa.auto_approve_after_days > 0
      AND q.status = 'sent'
      AND qa.is_used = false
  LOOP
    -- Calculate auto-approve date
    v_auto_approve_date := v_approval.created_at + (v_approval.auto_approve_after_days || ' days')::interval;
    
    -- Check if we should auto-approve
    IF now() >= v_auto_approve_date THEN
      -- Update quote to approved
      UPDATE quotes
      SET 
        status = 'approved',
        approved_at = now(),
        updated_at = now()
      WHERE id = v_approval.quote_id;
      
      -- Mark approval as used
      UPDATE quote_approvals
      SET is_used = true
      WHERE id = v_approval.id;
      
      -- Create approval response
      INSERT INTO quote_approval_responses (
        approval_id,
        company_id,
        approved,
        approver_name,
        approver_email,
        notes,
        responded_at
      ) VALUES (
        v_approval.id,
        v_approval.company_id,
        true,
        'System Auto-Approval',
        'system@auto-approval',
        'Automatically approved after ' || v_approval.auto_approve_after_days || ' days',
        now()
      );
      
      -- Log activity
      INSERT INTO quote_activity_log (
        quote_id,
        company_id,
        action,
        performed_by,
        performed_by_name,
        performed_at,
        meta
      ) VALUES (
        v_approval.quote_id,
        v_approval.company_id,
        'auto_approved',
        NULL,
        'System',
        now(),
        jsonb_build_object(
          'auto_approve_after_days', v_approval.auto_approve_after_days,
          'approval_id', v_approval.id
        )
      );
      
      RAISE NOTICE 'Auto-approved quote % after % days', v_approval.quote_id, v_approval.auto_approve_after_days;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to expire quotes past their valid_until date
CREATE OR REPLACE FUNCTION expire_old_quotes()
RETURNS void AS $$
DECLARE
  v_quote RECORD;
BEGIN
  -- Loop through quotes that are sent but past valid_until
  FOR v_quote IN
    SELECT 
      id,
      quote_number,
      company_id,
      valid_until
    FROM quotes
    WHERE status = 'sent'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE
  LOOP
    -- Update quote to expired
    UPDATE quotes
    SET 
      status = 'expired',
      updated_at = now()
    WHERE id = v_quote.id;
    
    -- Log activity
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by,
      performed_by_name,
      performed_at,
      meta
    ) VALUES (
      v_quote.id,
      v_quote.company_id,
      'expired',
      NULL,
      'System',
      now(),
      jsonb_build_object(
        'valid_until', v_quote.valid_until,
        'expired_at', now()
      )
    );
    
    RAISE NOTICE 'Expired quote % (valid until: %)', v_quote.quote_number, v_quote.valid_until;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create combined function to run both processes
CREATE OR REPLACE FUNCTION process_quote_background_jobs()
RETURNS void AS $$
BEGIN
  -- Process auto-approvals
  PERFORM process_quote_auto_approvals();
  
  -- Expire old quotes
  PERFORM expire_old_quotes();
  
  RAISE NOTICE 'Quote background jobs completed at %', now();
END;
$$ LANGUAGE plpgsql;

-- Schedule cron job to run daily at 2 AM
-- Note: pg_cron extension must be enabled
DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('process-quote-background-jobs');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'process-quote-background-jobs',
      '0 2 * * *', -- Run at 2 AM every day
      'SELECT process_quote_background_jobs();'
    );
    
    RAISE NOTICE 'Scheduled quote background jobs cron';
  ELSE
    RAISE NOTICE 'pg_cron extension not available, background jobs not scheduled';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $$;
