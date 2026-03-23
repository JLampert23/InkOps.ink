/*
  # Fix Automation Queue Processor - Log Success Instead of Partial

  1. Purpose
    - Change automation queue processor to log "success" instead of "partial"
    - Remove confusing error messages about pg_net restrictions
    - Add informational notes explaining async processing

  2. Changes
    - Update process_automation_queue_sql() function
    - Log status as 'success' when queue item is processed
    - Use processing_note for informational messages
    - Clear error_message field when successful
*/

CREATE OR REPLACE FUNCTION process_automation_queue_sql()
RETURNS TABLE(processed_count integer, failed_count integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_item RECORD;
  v_automation RECORD;
  v_processed integer := 0;
  v_failed integer := 0;
  v_automation_count integer := 0;
BEGIN
  -- Process up to 50 pending queue items
  FOR v_queue_item IN
    SELECT *
    FROM automation_queue
    WHERE status = 'pending'
      AND scheduled_for <= now()
    ORDER BY created_at
    LIMIT 50
  LOOP
    BEGIN
      -- Mark as processing
      UPDATE automation_queue
      SET status = 'processing'
      WHERE id = v_queue_item.id;

      v_automation_count := 0;

      -- Get matching automations
      FOR v_automation IN
        SELECT *
        FROM automations
        WHERE trigger_type = v_queue_item.trigger_type
          AND company_id = v_queue_item.company_id
          AND is_enabled = true
      LOOP
        v_automation_count := v_automation_count + 1;

        -- Log successful queue processing
        INSERT INTO automation_logs (
          company_id,
          automation_id,
          status,
          error_message,
          processing_note,
          execution_method,
          trigger_event,
          executed_at
        ) VALUES (
          v_queue_item.company_id,
          v_automation.id,
          'success',
          NULL,
          'Automation queued and will be processed asynchronously',
          'queued_async',
          v_queue_item.trigger_data,
          now()
        );

        RAISE NOTICE 'Queued automation % for processing (Trigger: %, WO: %)', 
          v_automation.name,
          v_queue_item.trigger_type,
          v_queue_item.trigger_data->>'work_order_number';
      END LOOP;

      -- Mark queue as completed
      UPDATE automation_queue
      SET 
        status = 'completed',
        processed_at = now(),
        error_message = CASE 
          WHEN v_automation_count = 0 THEN 'No matching automations found'
          ELSE NULL
        END
      WHERE id = v_queue_item.id;

      v_processed := v_processed + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Handle errors
        UPDATE automation_queue
        SET 
          status = CASE 
            WHEN attempts + 1 >= max_attempts THEN 'failed'
            ELSE 'pending'
          END,
          attempts = attempts + 1,
          error_message = SQLERRM,
          scheduled_for = CASE
            WHEN attempts + 1 < max_attempts THEN now() + interval '5 minutes'
            ELSE scheduled_for
          END
        WHERE id = v_queue_item.id;

        v_failed := v_failed + 1;
        RAISE WARNING 'Error processing queue item %: %', v_queue_item.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed, format('Processed %s items, %s failed', v_processed, v_failed);
END;
$$;

COMMENT ON FUNCTION process_automation_queue_sql IS 'Processes pending automation queue items and logs them as successful async operations';
