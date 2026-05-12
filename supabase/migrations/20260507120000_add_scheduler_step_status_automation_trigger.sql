/*
  # Add Production Schedule Step Status Automation Trigger

  1. Problem
    - Automations with trigger_type='work_step_status_changed' never fire when a
      scheduler step status changes. The existing function with that name is
      attached to the work_orders table (mis-wired since codebase inheritance),
      not production_schedule_entries.
    - Result: client's "PRODUCTION COMPLETE" rule has been silently dead and we
      didn't catch it sooner because the JWT bug was masking the broader issue.

  2. Solution
    - New trigger on production_schedule_entries fires AFTER UPDATE of the
      step_statuses JSONB column.
    - Walks each step in step_statuses, detects which ones transitioned, and
      compares the new value to each enabled automation's
      trigger_config.status_name.
    - Optionally narrows by trigger_config.work_type_name matching the entry's
      type_of_work, so a Screen Print rule doesn't fire on Embroidery rows.

  3. Behavior
    - Only enqueues when status was different in OLD (real transition).
    - Skips automations with empty status_name in trigger_config.
    - Trigger data carries enough identifiers (entry, WO, quote, imprint, step,
      old/new status) for downstream send-email shortcodes.
*/

CREATE OR REPLACE FUNCTION enqueue_scheduler_step_status_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_automation record;
  v_step_id text;
  v_new_status text;
  v_old_status text;
  v_target_status text;
  v_work_type_name text;
  v_trigger_data jsonb;
BEGIN
  IF OLD.step_statuses IS NOT DISTINCT FROM NEW.step_statuses THEN
    RETURN NEW;
  END IF;

  FOR v_automation IN
    SELECT id, name, trigger_config
    FROM automations
    WHERE company_id = NEW.company_id
      AND is_enabled = true
      AND trigger_type = 'work_step_status_changed'
  LOOP
    v_target_status  := v_automation.trigger_config->>'status_name';
    v_work_type_name := v_automation.trigger_config->>'work_type_name';

    CONTINUE WHEN v_target_status IS NULL OR v_target_status = '';

    CONTINUE WHEN v_work_type_name IS NOT NULL
      AND v_work_type_name <> ''
      AND NEW.type_of_work IS DISTINCT FROM v_work_type_name;

    FOR v_step_id, v_new_status IN
      SELECT key, value FROM jsonb_each_text(NEW.step_statuses)
    LOOP
      v_old_status := COALESCE(OLD.step_statuses->>v_step_id, '');

      IF v_new_status = v_target_status
         AND v_old_status IS DISTINCT FROM v_new_status THEN

        v_trigger_data := jsonb_build_object(
          'schedule_entry_id', NEW.id,
          'work_order_id',     NEW.work_order_id,
          'quote_id',          NEW.quote_id,
          'imprint_id',        NEW.imprint_id,
          'imprint_number',    NEW.imprint_number,
          'customer_name',     NEW.customer_name,
          'quote_number',      NEW.quote_number,
          'type_of_work',      NEW.type_of_work,
          'step_id',           v_step_id,
          'old_status',        v_old_status,
          'new_status',        v_new_status,
          'changed_at',        now()
        );

        INSERT INTO automation_queue (
          company_id,
          automation_id,
          trigger_type,
          trigger_data,
          status,
          scheduled_for
        ) VALUES (
          NEW.company_id,
          v_automation.id,
          'work_step_status_changed',
          v_trigger_data,
          'pending',
          now()
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_scheduler_step_status_automation
  ON production_schedule_entries;

CREATE TRIGGER trigger_scheduler_step_status_automation
  AFTER UPDATE OF step_statuses ON production_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_scheduler_step_status_automation();

COMMENT ON FUNCTION enqueue_scheduler_step_status_automation() IS
  'Fires on production_schedule_entries.step_statuses change. For each enabled work_step_status_changed automation whose trigger_config matches the entry''s type_of_work, enqueues an automation_queue row when any step transitions to the rule''s target status_name.';
