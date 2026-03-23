/*
  # Fix Work Order Automation Trigger Column References
  
  1. Problem
    - Trigger function references non-existent columns:
      - `action_config` (should be `actions`)
      - `is_active` (should be `is_enabled`)
    - This causes "column does not exist" errors when updating work orders
  
  2. Solution
    - Update function to use correct column names from automations table
    - Change `action_config` to `actions`
    - Change `is_active` to `is_enabled`
  
  3. Impact
    - Fixes work order status update errors
    - Ensures automation triggers work correctly
*/

CREATE OR REPLACE FUNCTION enqueue_work_order_status_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status_name text;
  v_new_status_name text;
  v_trigger_data jsonb;
  v_customer_email text;
  v_automation record;
BEGIN
  -- Only trigger if custom_invoice_status_id has changed
  IF (TG_OP = 'UPDATE' AND OLD.custom_invoice_status_id IS DISTINCT FROM NEW.custom_invoice_status_id)
     OR (TG_OP = 'INSERT' AND NEW.custom_invoice_status_id IS NOT NULL) THEN

    -- Get the old status name if it exists
    IF OLD.custom_invoice_status_id IS NOT NULL THEN
      SELECT name INTO v_old_status_name
      FROM custom_invoice_statuses
      WHERE id = OLD.custom_invoice_status_id;
    END IF;

    -- Get the new status name
    IF NEW.custom_invoice_status_id IS NOT NULL THEN
      SELECT name INTO v_new_status_name
      FROM custom_invoice_statuses
      WHERE id = NEW.custom_invoice_status_id;
    END IF;

    -- Get customer email from customers table
    SELECT email INTO v_customer_email
    FROM customers
    WHERE id = NEW.customer_id;

    -- Build trigger data with work order details
    v_trigger_data := jsonb_build_object(
      'work_order_id', NEW.id,
      'work_order_number', NEW.work_order_number,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'customer_email', v_customer_email,
      'quote_id', NEW.quote_id,
      'old_status_id', OLD.custom_invoice_status_id,
      'new_status_id', NEW.custom_invoice_status_id,
      'old_status', COALESCE(v_old_status_name, ''),
      'new_status', COALESCE(v_new_status_name, ''),
      'work_order_status', NEW.status,
      'priority', NEW.priority,
      'production_due_date', NEW.production_due_date,
      'customer_due_date', NEW.customer_due_date,
      'total_quantity', NEW.total_quantity,
      'changed_at', now()
    );

    -- Find all enabled automations for this trigger type and company
    -- FIXED: Changed action_config to actions, is_active to is_enabled
    FOR v_automation IN 
      SELECT id, name, trigger_config, actions
      FROM automations
      WHERE company_id = NEW.company_id
        AND is_enabled = true
        AND trigger_type = 'work_order_invoice_status_changed'
    LOOP
      -- Check if the automation's trigger conditions match
      -- For now, we enqueue all matching automations
      -- The automation processor will evaluate conditions
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
        'work_order_invoice_status_changed',
        v_trigger_data,
        'pending',
        now()
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enqueue_work_order_status_automation() IS 'Enqueues automation events when work order invoice status changes - uses correct column names (actions, is_enabled)';