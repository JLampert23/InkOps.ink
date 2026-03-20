/*
  # Add Work Order Invoice Status Change Automation Trigger

  1. Database Trigger
    - Create trigger function to detect custom_invoice_status_id changes on work_orders
    - Queue matching automations when invoice status changes
    - Include comprehensive trigger data for automation conditions and actions

  2. Trigger Data Structure
    - work_order_id: UUID of the work order
    - work_order_number: Human-readable work order number
    - old_status_id: Previous custom invoice status ID (may be null)
    - old_status_name: Previous status name (may be null)
    - new_status_id: New custom invoice status ID (may be null)
    - new_status_name: New status name (may be null)
    - customer_id: Customer UUID
    - customer_name: Customer name
    - quote_id: Associated quote ID (may be null)
    - company_id: Company ID for context

  3. Purpose
    - Enable automation workflows based on invoice status changes
    - Support billing/payment-related business process automation
    - Trigger notifications, status updates, and other actions
*/

-- Function to trigger automations when work order invoice status changes
CREATE OR REPLACE FUNCTION trigger_automation_work_order_invoice_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status_name text;
  v_new_status_name text;
  v_trigger_data jsonb;
BEGIN
  -- Only process if custom_invoice_status_id actually changed
  IF OLD.custom_invoice_status_id IS DISTINCT FROM NEW.custom_invoice_status_id THEN
    
    -- Get old status name if exists
    IF OLD.custom_invoice_status_id IS NOT NULL THEN
      SELECT name INTO v_old_status_name
      FROM custom_invoice_statuses
      WHERE id = OLD.custom_invoice_status_id;
    END IF;
    
    -- Get new status name if exists
    IF NEW.custom_invoice_status_id IS NOT NULL THEN
      SELECT name INTO v_new_status_name
      FROM custom_invoice_statuses
      WHERE id = NEW.custom_invoice_status_id;
    END IF;
    
    -- Build trigger data
    v_trigger_data := jsonb_build_object(
      'work_order_id', NEW.id,
      'work_order_number', NEW.work_order_number,
      'old_status_id', OLD.custom_invoice_status_id,
      'old_status_name', v_old_status_name,
      'new_status_id', NEW.custom_invoice_status_id,
      'new_status_name', v_new_status_name,
      'customer_id', NEW.customer_id,
      'customer_name', NEW.customer_name,
      'quote_id', NEW.quote_id,
      'company_id', NEW.company_id,
      'status', NEW.status,
      'priority', NEW.priority,
      'production_due_date', NEW.production_due_date,
      'customer_due_date', NEW.customer_due_date,
      'changed_at', now()
    );
    
    -- Queue matching automations
    PERFORM queue_matching_automations(
      NEW.company_id,
      'work_order_invoice_status_changed',
      v_trigger_data
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on work_orders table
DROP TRIGGER IF EXISTS trigger_work_order_invoice_status_automation ON work_orders;

CREATE TRIGGER trigger_work_order_invoice_status_automation
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  WHEN (OLD.custom_invoice_status_id IS DISTINCT FROM NEW.custom_invoice_status_id)
  EXECUTE FUNCTION trigger_automation_work_order_invoice_status_changed();
