/*
  # Integrate Job Completion Automation with Production Workflow

  1. Features
    - Trigger job completion automation when work order completes
    - Optional automatic delivery task creation
    - Optional automatic archiving
    - Configurable per company

  2. Company Settings
    - Add automation preferences to company_settings

  3. Trigger
    - When work_order_workflow_tracking.current_stage_key changes to 'completed'
    - Automatically trigger job completion automation
*/

-- Add job completion automation settings to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'auto_create_delivery_on_completion'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN auto_create_delivery_on_completion boolean DEFAULT true;
    ALTER TABLE company_settings ADD COLUMN default_delivery_type text DEFAULT 'pickup' CHECK (default_delivery_type IN ('pickup', 'local_delivery', 'shipping', 'courier'));
    ALTER TABLE company_settings ADD COLUMN auto_finalize_invoice_on_completion boolean DEFAULT true;
    ALTER TABLE company_settings ADD COLUMN auto_send_invoice_on_completion boolean DEFAULT false;
    ALTER TABLE company_settings ADD COLUMN auto_archive_on_completion boolean DEFAULT false;
    ALTER TABLE company_settings ADD COLUMN days_before_auto_archive integer DEFAULT 30;
  END IF;
END $$;

-- Function to trigger job completion automation on workflow completion
CREATE OR REPLACE FUNCTION trigger_job_completion_on_workflow_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_settings record;
  v_result jsonb;
BEGIN
  -- Only trigger when moving TO completed stage
  IF NEW.current_stage_key = 'completed' AND (OLD.current_stage_key IS NULL OR OLD.current_stage_key != 'completed') THEN
    
    -- Get company automation settings
    SELECT 
      auto_create_delivery_on_completion,
      default_delivery_type,
      auto_finalize_invoice_on_completion,
      auto_send_invoice_on_completion,
      auto_archive_on_completion
    INTO v_settings
    FROM company_settings
    WHERE id = NEW.company_id;

    -- If company settings not found, use defaults
    IF NOT FOUND THEN
      v_settings.auto_create_delivery_on_completion := true;
      v_settings.default_delivery_type := 'pickup';
      v_settings.auto_finalize_invoice_on_completion := true;
      v_settings.auto_send_invoice_on_completion := false;
      v_settings.auto_archive_on_completion := false;
    END IF;

    -- Trigger job completion automation
    -- Use completed_by as the user, or system if null
    v_result := complete_job_automation(
      NEW.work_order_id,
      COALESCE(NEW.completed_by, '00000000-0000-0000-0000-000000000000'::uuid),
      v_settings.auto_finalize_invoice_on_completion,
      v_settings.auto_send_invoice_on_completion,
      v_settings.auto_create_delivery_on_completion,
      COALESCE(v_settings.default_delivery_type, 'pickup'),
      NULL, -- delivery address will be populated from work order/customer data
      v_settings.auto_archive_on_completion
    );

    -- Log the result
    RAISE NOTICE 'Job completion automation triggered for work order %. Result: %', 
      NEW.work_order_id, v_result;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on work_order_workflow_tracking
DROP TRIGGER IF EXISTS trigger_job_completion_automation ON work_order_workflow_tracking;

CREATE TRIGGER trigger_job_completion_automation
  AFTER UPDATE OF current_stage_key ON work_order_workflow_tracking
  FOR EACH ROW
  WHEN (NEW.current_stage_key = 'completed')
  EXECUTE FUNCTION trigger_job_completion_on_workflow_complete();

-- Function to schedule auto-archiving for completed jobs
CREATE OR REPLACE FUNCTION schedule_auto_archive_for_completed_jobs()
RETURNS void AS $$
DECLARE
  v_work_order record;
  v_days_before_archive integer;
  v_archive_cutoff timestamptz;
  v_result jsonb;
  v_archived_count integer := 0;
BEGIN
  -- Process each company's completed work orders
  FOR v_work_order IN
    SELECT DISTINCT
      wt.work_order_id,
      wt.company_id,
      wt.completed_at,
      cs.days_before_auto_archive,
      cs.auto_archive_on_completion,
      wo.archived
    FROM work_order_workflow_tracking wt
    JOIN work_orders wo ON wo.id = wt.work_order_id
    JOIN company_settings cs ON cs.id = wt.company_id
    WHERE wt.current_stage_key = 'completed'
      AND wt.completed_at IS NOT NULL
      AND wo.archived = false
      AND cs.days_before_auto_archive IS NOT NULL
      AND cs.days_before_auto_archive > 0
  LOOP
    -- Calculate archive cutoff date
    v_archive_cutoff := now() - (v_work_order.days_before_auto_archive || ' days')::interval;

    -- Check if work order is old enough to archive
    IF v_work_order.completed_at < v_archive_cutoff THEN
      -- Archive the job (use system user UUID)
      v_result := archive_job(
        v_work_order.work_order_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        true,
        true
      );

      IF (v_result->>'success')::boolean THEN
        v_archived_count := v_archived_count + 1;
        
        -- Log the auto-archiving
        PERFORM log_completion_step(
          v_work_order.work_order_id,
          'auto_archived',
          'completed',
          format('Job auto-archived after %s days', v_work_order.days_before_auto_archive),
          NULL,
          NULL,
          jsonb_build_object('days_after_completion', v_work_order.days_before_auto_archive)
        );
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Auto-archived % completed jobs', v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION schedule_auto_archive_for_completed_jobs TO authenticated;

COMMENT ON FUNCTION trigger_job_completion_on_workflow_complete IS 'Automatically trigger job completion automation when work order reaches completed stage';
COMMENT ON FUNCTION schedule_auto_archive_for_completed_jobs IS 'Schedule auto-archiving for completed jobs based on company settings (run via cron)';

-- Note: To enable scheduled auto-archiving, create a cron job:
-- SELECT cron.schedule(
--   'auto-archive-completed-jobs',
--   '0 2 * * *',  -- Run at 2 AM daily
--   $$ SELECT schedule_auto_archive_for_completed_jobs(); $$
-- );
