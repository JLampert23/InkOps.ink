/*
  # Fix Automation Queue Schema Alignment
  
  1. Problem
    - Two migrations created automation_queue with different column names
    - Migration 20260212200617 uses "trigger_data"
    - Migration 20260320163732 uses "event_data"
    - This causes insert failures
  
  2. Solution
    - Rename event_data to trigger_data if event_data exists
    - Ensure consistent schema across all automation_queue references
  
  3. Security
    - No RLS changes needed
*/

-- Check if event_data column exists and rename to trigger_data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_queue'
    AND column_name = 'event_data'
  ) THEN
    -- Rename event_data to trigger_data
    ALTER TABLE automation_queue RENAME COLUMN event_data TO trigger_data;
  END IF;
END $$;

-- Ensure trigger_data column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_queue'
    AND column_name = 'trigger_data'
  ) THEN
    -- Add trigger_data column if it doesn't exist
    ALTER TABLE automation_queue ADD COLUMN trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update the enqueue function to use trigger_data instead of event_data
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

    -- Enqueue the automation event using trigger_data column
    INSERT INTO automation_queue (
      company_id,
      trigger_type,
      trigger_data,
      status
    ) VALUES (
      NEW.company_id,
      'work_order_invoice_status_changed',
      v_trigger_data,
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Add comment
COMMENT ON FUNCTION enqueue_work_order_status_automation() IS 'Enqueues automation events when work order invoice status changes - uses trigger_data column';