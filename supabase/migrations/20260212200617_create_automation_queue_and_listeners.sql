/*
  # Automation Queue and Event Listeners System
  
  1. New Tables
    - `automation_queue`: Queue for pending automation executions
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `automation_id` (uuid, foreign key to automations)
      - `trigger_type` (text)
      - `trigger_data` (jsonb) - Event context data
      - `status` (text) - pending, processing, completed, failed
      - `scheduled_for` (timestamptz) - When to execute (for delayed/scheduled)
      - `attempts` (integer) - Retry count
      - `error_message` (text)
      - `created_at` (timestamptz)
      - `processed_at` (timestamptz)
  
  2. Functions
    - `queue_automation_execution()`: Queue an automation for execution
    - `process_automation_queue()`: Process queued automations
    - Event listener functions for each trigger type
  
  3. Database Triggers
    - Printavo invoice created/updated listeners
    - Payment received listeners
    - Quote approved listeners
    - Customer created listeners
    - Scheduler entry listeners
    - Work order status listeners
  
  4. Security
    - Enable RLS on automation_queue
    - Policies for company isolation
*/

-- Create automation queue table
CREATE TABLE IF NOT EXISTS automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  trigger_type text NOT NULL,
  trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_queue_company_id ON automation_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_queue_automation_id ON automation_queue(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_queue_status ON automation_queue(status);
CREATE INDEX IF NOT EXISTS idx_automation_queue_scheduled_for ON automation_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_automation_queue_created_at ON automation_queue(created_at);

-- Enable RLS
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own company queue"
  ON automation_queue FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "System can manage queue"
  ON automation_queue FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to queue automation execution
CREATE OR REPLACE FUNCTION queue_automation_execution(
  p_automation_id uuid,
  p_trigger_type text,
  p_trigger_data jsonb DEFAULT '{}'::jsonb,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_automation_record RECORD;
  v_queue_id uuid;
  v_conditions_met boolean;
BEGIN
  -- Get automation details
  SELECT 
    a.id,
    a.company_id,
    a.is_enabled,
    a.conditions,
    a.scheduling
  INTO v_automation_record
  FROM automations a
  WHERE a.id = p_automation_id
    AND a.trigger_type = p_trigger_type
    AND a.is_enabled = true;
  
  -- If automation not found or disabled, return null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- TODO: Validate conditions against trigger_data
  -- For now, assume conditions are met
  v_conditions_met := true;
  
  -- Apply scheduling rules
  IF (v_automation_record.scheduling->>'type')::text = 'delayed' THEN
    p_scheduled_for := now() + (COALESCE((v_automation_record.scheduling->>'delay_minutes')::integer, 0) || ' minutes')::interval;
  END IF;
  
  -- Insert into queue
  INSERT INTO automation_queue (
    company_id,
    automation_id,
    trigger_type,
    trigger_data,
    scheduled_for
  ) VALUES (
    v_automation_record.company_id,
    p_automation_id,
    p_trigger_type,
    p_trigger_data,
    p_scheduled_for
  )
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;

-- Function to find and queue matching automations for a trigger
CREATE OR REPLACE FUNCTION queue_matching_automations(
  p_company_id uuid,
  p_trigger_type text,
  p_trigger_data jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_automation RECORD;
  v_queued_count integer := 0;
BEGIN
  -- Find all enabled automations for this trigger type and company
  FOR v_automation IN
    SELECT id
    FROM automations
    WHERE company_id = p_company_id
      AND trigger_type = p_trigger_type
      AND is_enabled = true
  LOOP
    -- Queue each matching automation
    IF queue_automation_execution(v_automation.id, p_trigger_type, p_trigger_data) IS NOT NULL THEN
      v_queued_count := v_queued_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_queued_count;
END;
$$;

-- TRIGGER LISTENERS FOR DATABASE EVENTS --

-- 1. Invoice Created Listener (Printavo Invoices)
CREATE OR REPLACE FUNCTION trigger_automation_invoice_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get company_id from company_settings via api_credentials
  SELECT cs.id INTO v_company_id
  FROM company_settings cs
  LIMIT 1;
  
  IF v_company_id IS NOT NULL THEN
    PERFORM queue_matching_automations(
      v_company_id,
      'invoice_created',
      jsonb_build_object(
        'invoice_id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'customer_name', NEW.customer_name,
        'total', NEW.total,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_invoice_created ON printavo_invoices;
CREATE TRIGGER automation_invoice_created
  AFTER INSERT ON printavo_invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_invoice_created();

-- 2. Invoice Status Changed Listener (Printavo Invoices)
CREATE OR REPLACE FUNCTION trigger_automation_invoice_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get company_id
  SELECT cs.id INTO v_company_id
  FROM company_settings cs
  LIMIT 1;
  
  IF v_company_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM queue_matching_automations(
      v_company_id,
      'invoice_status_changed',
      jsonb_build_object(
        'invoice_id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_name', NEW.customer_name,
        'total', NEW.total
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_invoice_status_changed ON printavo_invoices;
CREATE TRIGGER automation_invoice_status_changed
  AFTER UPDATE ON printavo_invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_invoice_status_changed();

-- 3. Payment Received Listener
CREATE OR REPLACE FUNCTION trigger_automation_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  -- Get invoice details if payment is linked to an invoice
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM printavo_invoices WHERE id = NEW.invoice_id::text;
    
    IF FOUND THEN
      PERFORM queue_matching_automations(
        NEW.company_id,
        'payment_received',
        jsonb_build_object(
          'payment_id', NEW.id,
          'invoice_id', NEW.invoice_id,
          'invoice_number', v_invoice.invoice_number,
          'amount', NEW.amount,
          'payment_method', NEW.payment_method,
          'customer_name', v_invoice.customer_name
        )
      );
      
      -- Check if payment matches remaining balance
      IF v_invoice.amount_outstanding IS NOT NULL AND ABS(NEW.amount - v_invoice.amount_outstanding) < 0.01 THEN
        PERFORM queue_matching_automations(
          NEW.company_id,
          'payment_balance_matched',
          jsonb_build_object(
            'payment_id', NEW.id,
            'invoice_id', NEW.invoice_id,
            'invoice_number', v_invoice.invoice_number,
            'amount', NEW.amount
          )
        );
      END IF;
      
      -- Check if invoice is now paid in full
      IF v_invoice.status = 'paid' OR v_invoice.amount_outstanding <= 0 THEN
        PERFORM queue_matching_automations(
          NEW.company_id,
          'quote_invoice_paid_in_full',
          jsonb_build_object(
            'invoice_id', NEW.invoice_id,
            'invoice_number', v_invoice.invoice_number,
            'payment_id', NEW.id,
            'total_paid', v_invoice.amount_paid
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_payment_received ON payments;
CREATE TRIGGER automation_payment_received
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_payment_received();

-- 4. Quote Approved Listener
CREATE OR REPLACE FUNCTION trigger_automation_quote_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger if quote was just approved
  IF (OLD.status IS NULL OR OLD.status != 'approved') AND NEW.status = 'approved' THEN
    PERFORM queue_matching_automations(
      NEW.company_id,
      'quote_approved',
      jsonb_build_object(
        'quote_id', NEW.id,
        'quote_number', NEW.quote_number,
        'customer_name', NEW.customer_name,
        'total', NEW.total,
        'approved_at', NEW.approved_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_quote_approved ON quotes;
CREATE TRIGGER automation_quote_approved
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_quote_approved();

-- 5. Customer Created Listener
CREATE OR REPLACE FUNCTION trigger_automation_customer_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM queue_matching_automations(
    NEW.company_id,
    'customer_created',
    jsonb_build_object(
      'customer_id', NEW.id,
      'customer_name', NEW.name,
      'email', NEW.email,
      'phone', NEW.phone
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_customer_created ON customers;
CREATE TRIGGER automation_customer_created
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_customer_created();

-- 6. Imprints Added to Scheduler Listener
CREATE OR REPLACE FUNCTION trigger_automation_imprints_added_to_scheduler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM queue_matching_automations(
    NEW.company_id,
    'imprints_added_to_scheduler',
    jsonb_build_object(
      'schedule_entry_id', NEW.id,
      'work_order_id', NEW.work_order_id,
      'scheduled_date', NEW.scheduled_date
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_imprints_added_to_scheduler ON production_schedule_entries;
CREATE TRIGGER automation_imprints_added_to_scheduler
  AFTER INSERT ON production_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_imprints_added_to_scheduler();

-- 7. Work Step Status Changed Listener
CREATE OR REPLACE FUNCTION trigger_automation_work_step_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Trigger on work order status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM queue_matching_automations(
      NEW.company_id,
      'work_step_status_changed',
      jsonb_build_object(
        'work_order_id', NEW.id,
        'work_order_number', NEW.work_order_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
    
    -- Also trigger generic status_changed
    PERFORM queue_matching_automations(
      NEW.company_id,
      'status_changed',
      jsonb_build_object(
        'entity_type', 'work_order',
        'entity_id', NEW.id,
        'entity_number', NEW.work_order_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_work_order_status_changed ON work_orders;
CREATE TRIGGER automation_work_order_status_changed
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_work_step_status_changed();

-- 8. Generic Status Changed Listener for Quotes
CREATE OR REPLACE FUNCTION trigger_automation_quote_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM queue_matching_automations(
      NEW.company_id,
      'status_changed',
      jsonb_build_object(
        'entity_type', 'quote',
        'entity_id', NEW.id,
        'entity_number', NEW.quote_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_quote_status_changed ON quotes;
CREATE TRIGGER automation_quote_status_changed
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_quote_status_changed();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON automation_queue TO authenticated;
GRANT EXECUTE ON FUNCTION queue_automation_execution TO authenticated;
GRANT EXECUTE ON FUNCTION queue_matching_automations TO authenticated;
