/*
  # Add Invoice Status Change Automation Trigger

  1. Purpose
    - Automatically trigger automations when work order invoice status changes
    - Enqueue automation events for asynchronous processing

  2. Changes
    - Create automation_queue table for queuing automation events
    - Add trigger function to detect custom_invoice_status_id changes in work_orders
    - Add trigger to enqueue automation events on status change

  3. Security
    - Enable RLS on automation_queue
    - Add policies for authenticated users to manage queue
*/

-- Create automation queue table for async processing
CREATE TABLE IF NOT EXISTS automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN (
    'approval_approved',
    'approval_declined',
    'approval_sent',
    'quote_invoice_paid_in_full',
    'status_changed',
    'imprints_added_to_scheduler',
    'work_step_status_changed',
    'work_order_invoice_status_changed'
  ))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_queue_status ON automation_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_automation_queue_company ON automation_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_queue_trigger_type ON automation_queue(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_queue_created_at ON automation_queue(created_at);

-- Enable RLS
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_queue
CREATE POLICY "Users can view their company's automation queue"
  ON automation_queue FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert to their company's automation queue"
  ON automation_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's automation queue"
  ON automation_queue FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Function to enqueue automation on work order invoice status change
CREATE OR REPLACE FUNCTION enqueue_work_order_status_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status_name text;
  v_new_status_name text;
  v_event_data jsonb;
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

    -- Build event data with work order details
    v_event_data := jsonb_build_object(
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

    -- Enqueue the automation event
    INSERT INTO automation_queue (
      company_id,
      trigger_type,
      event_data,
      status
    ) VALUES (
      NEW.company_id,
      'work_order_invoice_status_changed',
      v_event_data,
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to work_orders for invoice status changes
DROP TRIGGER IF EXISTS trigger_work_order_invoice_status_automation ON work_orders;
CREATE TRIGGER trigger_work_order_invoice_status_automation
  AFTER INSERT OR UPDATE OF custom_invoice_status_id ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_work_order_status_automation();

-- Add comment
COMMENT ON TABLE automation_queue IS 'Queue for automation events to be processed asynchronously';
COMMENT ON FUNCTION enqueue_work_order_status_automation() IS 'Enqueues automation events when work order invoice status changes';
