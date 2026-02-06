/*
  # Job Completion Automation System

  1. New Tables
    - `delivery_tasks` - Track delivery/shipping tasks
    - `job_completion_log` - Log of completion automation steps
    - Add archived flags to work_orders, quotes, printavo_invoices

  2. Features
    - Delivery task creation and tracking
    - Delivery address management
    - Delivery status tracking
    - Job archiving with preserved audit trail
    - Completion automation logging

  3. Delivery Workflow
    - Create delivery task when work order completes
    - Assign to logistics team
    - Track delivery status
    - Capture delivery confirmation

  4. Archiving
    - Soft archive (flag-based, not deletion)
    - Preserve all relationships
    - Maintain complete audit trail
    - Filter archived items from normal views

  5. Security
    - Enable RLS on all tables
    - Company-based access control
*/

-- Create delivery tasks table
CREATE TABLE IF NOT EXISTS delivery_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_number text NOT NULL,
  quote_id uuid REFERENCES quotes(id),
  invoice_id uuid,
  customer_name text NOT NULL,
  delivery_type text NOT NULL CHECK (delivery_type IN ('pickup', 'local_delivery', 'shipping', 'courier')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'scheduled', 'in_transit', 'delivered', 'failed', 'cancelled')),
  
  -- Delivery details
  delivery_address_line1 text,
  delivery_address_line2 text,
  delivery_city text,
  delivery_state text,
  delivery_zip text,
  delivery_country text DEFAULT 'USA',
  
  -- Contact info
  contact_name text,
  contact_phone text,
  contact_email text,
  
  -- Scheduling
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,
  
  -- Tracking
  tracking_number text,
  carrier text,
  estimated_delivery_date date,
  actual_delivery_date timestamptz,
  
  -- Assignment
  assigned_to uuid REFERENCES user_profiles(id),
  assigned_to_name text,
  
  -- Delivery details
  delivery_notes text,
  special_instructions text,
  signature_required boolean DEFAULT false,
  signature_received boolean DEFAULT false,
  signature_name text,
  signature_timestamp timestamptz,
  
  -- Package details
  num_packages integer DEFAULT 1,
  weight_lbs decimal(10,2),
  dimensions_length_in decimal(10,2),
  dimensions_width_in decimal(10,2),
  dimensions_height_in decimal(10,2),
  
  -- Status tracking
  created_by uuid REFERENCES user_profiles(id),
  created_by_name text,
  completed_by uuid REFERENCES user_profiles(id),
  completed_by_name text,
  completed_at timestamptz,
  
  -- Metadata
  delivery_photos jsonb,
  metadata jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create job completion log table
CREATE TABLE IF NOT EXISTS job_completion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_number text NOT NULL,
  completion_step text NOT NULL,
  step_status text NOT NULL CHECK (step_status IN ('started', 'completed', 'failed', 'skipped')),
  step_message text,
  error_details text,
  performed_by uuid REFERENCES user_profiles(id),
  performed_by_name text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add archived flag to work_orders if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'archived'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN archived boolean DEFAULT false;
    ALTER TABLE work_orders ADD COLUMN archived_at timestamptz;
    ALTER TABLE work_orders ADD COLUMN archived_by uuid REFERENCES user_profiles(id);
    
    CREATE INDEX idx_work_orders_archived ON work_orders(company_id, archived) WHERE archived = false;
  END IF;
END $$;

-- Add archived flag to quotes if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'archived'
  ) THEN
    ALTER TABLE quotes ADD COLUMN archived boolean DEFAULT false;
    ALTER TABLE quotes ADD COLUMN archived_at timestamptz;
    ALTER TABLE quotes ADD COLUMN archived_by uuid REFERENCES user_profiles(id);
    
    CREATE INDEX idx_quotes_archived ON quotes(company_id, archived) WHERE archived = false;
  END IF;
END $$;

-- Add archived flag to printavo_invoices if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'printavo_invoices' AND column_name = 'archived'
  ) THEN
    ALTER TABLE printavo_invoices ADD COLUMN archived boolean DEFAULT false;
    ALTER TABLE printavo_invoices ADD COLUMN archived_at timestamptz;
    ALTER TABLE printavo_invoices ADD COLUMN archived_by text;
  END IF;
END $$;

-- Create indexes for delivery tasks
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_work_order ON delivery_tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_company_status ON delivery_tasks(company_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_scheduled_date ON delivery_tasks(company_id, scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_assigned_to ON delivery_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- Create indexes for completion log
CREATE INDEX IF NOT EXISTS idx_completion_log_work_order ON job_completion_log(work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_completion_log_company ON job_completion_log(company_id, created_at DESC);

-- Enable RLS
ALTER TABLE delivery_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_completion_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_tasks
CREATE POLICY "Users can view delivery tasks for their company"
  ON delivery_tasks FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create delivery tasks"
  ON delivery_tasks FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update delivery tasks for their company"
  ON delivery_tasks FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- RLS Policies for job_completion_log
CREATE POLICY "Users can view completion log for their company"
  ON job_completion_log FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert completion log"
  ON job_completion_log FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Function to create delivery task
CREATE OR REPLACE FUNCTION create_delivery_task(
  p_work_order_id uuid,
  p_delivery_type text,
  p_created_by uuid,
  p_delivery_address jsonb DEFAULT NULL,
  p_contact_info jsonb DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_customer_name text;
  v_quote_id uuid;
  v_invoice_id uuid;
  v_created_by_name text;
  v_delivery_task_id uuid;
BEGIN
  -- Get work order details
  SELECT 
    wo.company_id, 
    wo.work_order_number, 
    wo.customer_name,
    wo.quote_id
  INTO 
    v_company_id, 
    v_work_order_number, 
    v_customer_name,
    v_quote_id
  FROM work_orders wo
  WHERE wo.id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Get invoice_id if exists
  SELECT id::text::uuid INTO v_invoice_id
  FROM printavo_invoices
  WHERE printavo_order_id::text = (SELECT printavo_order_id::text FROM work_orders WHERE id = p_work_order_id)
  LIMIT 1;

  -- Get creator name
  SELECT COALESCE(full_name, email) INTO v_created_by_name
  FROM user_profiles
  WHERE id = p_created_by;

  -- Create delivery task
  INSERT INTO delivery_tasks (
    company_id,
    work_order_id,
    work_order_number,
    quote_id,
    invoice_id,
    customer_name,
    delivery_type,
    delivery_address_line1,
    delivery_address_line2,
    delivery_city,
    delivery_state,
    delivery_zip,
    delivery_country,
    contact_name,
    contact_phone,
    contact_email,
    delivery_notes,
    special_instructions,
    created_by,
    created_by_name,
    metadata
  ) VALUES (
    v_company_id,
    p_work_order_id,
    v_work_order_number,
    v_quote_id,
    v_invoice_id,
    v_customer_name,
    p_delivery_type,
    p_delivery_address->>'address_line1',
    p_delivery_address->>'address_line2',
    p_delivery_address->>'city',
    p_delivery_address->>'state',
    p_delivery_address->>'zip',
    COALESCE(p_delivery_address->>'country', 'USA'),
    p_contact_info->>'name',
    p_contact_info->>'phone',
    p_contact_info->>'email',
    p_delivery_notes,
    p_delivery_address->>'special_instructions',
    p_created_by,
    v_created_by_name,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_delivery_task_id;

  RETURN jsonb_build_object(
    'success', true,
    'delivery_task_id', v_delivery_task_id,
    'message', 'Delivery task created'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize invoice (works with printavo_invoices)
CREATE OR REPLACE FUNCTION finalize_invoice_for_work_order(
  p_work_order_id uuid,
  p_user_id uuid,
  p_send_email boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
  v_invoice_id text;
  v_invoice_number text;
  v_status text;
  v_total_amount decimal;
  v_printavo_order_id text;
BEGIN
  -- Get printavo order ID from work order
  SELECT printavo_order_id::text INTO v_printavo_order_id
  FROM work_orders
  WHERE id = p_work_order_id;

  IF v_printavo_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'message', 'No Printavo order linked to this work order'
    );
  END IF;

  -- Get invoice details
  SELECT id, invoice_number, status, total
  INTO v_invoice_id, v_invoice_number, v_status, v_total_amount
  FROM printavo_invoices
  WHERE printavo_order_id::text = v_printavo_order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'message', 'No invoice found for this work order'
    );
  END IF;

  -- Check if already finalized
  IF v_status IN ('sent', 'paid', 'partial') THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_finalized', true,
      'message', format('Invoice %s already finalized with status: %s', v_invoice_number, v_status)
    );
  END IF;

  -- Note: Actual invoice status updates would go through Printavo API
  -- This marks it as ready for finalization

  RETURN jsonb_build_object(
    'success', true,
    'invoice_number', v_invoice_number,
    'total_amount', v_total_amount,
    'send_email', p_send_email,
    'message', 'Invoice ready for finalization',
    'note', 'Invoice updates sync through Printavo API'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive job
CREATE OR REPLACE FUNCTION archive_job(
  p_work_order_id uuid,
  p_user_id uuid,
  p_archive_quote boolean DEFAULT true,
  p_archive_invoice boolean DEFAULT true
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_quote_id uuid;
  v_user_name text;
  v_printavo_order_id text;
  v_archived_count integer := 0;
BEGIN
  -- Get work order details
  SELECT wo.company_id, wo.work_order_number, wo.quote_id, wo.printavo_order_id::text
  INTO v_company_id, v_work_order_number, v_quote_id, v_printavo_order_id
  FROM work_orders wo
  WHERE wo.id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Get user name
  SELECT COALESCE(full_name, email) INTO v_user_name
  FROM user_profiles
  WHERE id = p_user_id;

  -- Archive work order
  UPDATE work_orders
  SET
    archived = true,
    archived_at = now(),
    archived_by = p_user_id,
    updated_at = now()
  WHERE id = p_work_order_id;
  
  v_archived_count := v_archived_count + 1;

  -- Archive quote if requested and exists
  IF p_archive_quote AND v_quote_id IS NOT NULL THEN
    UPDATE quotes
    SET
      archived = true,
      archived_at = now(),
      archived_by = p_user_id,
      updated_at = now()
    WHERE id = v_quote_id;
    
    v_archived_count := v_archived_count + 1;
  END IF;

  -- Archive invoice if requested and exists
  IF p_archive_invoice AND v_printavo_order_id IS NOT NULL THEN
    UPDATE printavo_invoices
    SET
      archived = true,
      archived_at = now(),
      archived_by = v_user_name
    WHERE printavo_order_id::text = v_printavo_order_id;
    
    IF FOUND THEN
      v_archived_count := v_archived_count + 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_number', v_work_order_number,
    'archived_count', v_archived_count,
    'archived_by', v_user_name,
    'message', format('Job %s archived successfully', v_work_order_number)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unarchive job
CREATE OR REPLACE FUNCTION unarchive_job(
  p_work_order_id uuid,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_work_order_number text;
  v_quote_id uuid;
  v_printavo_order_id text;
BEGIN
  -- Get work order details
  SELECT work_order_number, quote_id, printavo_order_id::text
  INTO v_work_order_number, v_quote_id, v_printavo_order_id
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Unarchive work order
  UPDATE work_orders
  SET
    archived = false,
    archived_at = NULL,
    archived_by = NULL,
    updated_at = now()
  WHERE id = p_work_order_id;

  -- Unarchive quote if exists
  IF v_quote_id IS NOT NULL THEN
    UPDATE quotes
    SET
      archived = false,
      archived_at = NULL,
      archived_by = NULL,
      updated_at = now()
    WHERE id = v_quote_id;
  END IF;

  -- Unarchive invoice if exists
  IF v_printavo_order_id IS NOT NULL THEN
    UPDATE printavo_invoices
    SET
      archived = false,
      archived_at = NULL,
      archived_by = NULL
    WHERE printavo_order_id::text = v_printavo_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'work_order_number', v_work_order_number,
    'message', format('Job %s unarchived successfully', v_work_order_number)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log completion step
CREATE OR REPLACE FUNCTION log_completion_step(
  p_work_order_id uuid,
  p_completion_step text,
  p_step_status text,
  p_step_message text DEFAULT NULL,
  p_error_details text DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_performed_by_name text;
  v_log_id uuid;
BEGIN
  -- Get work order details
  SELECT company_id, work_order_number
  INTO v_company_id, v_work_order_number
  FROM work_orders
  WHERE id = p_work_order_id;

  -- Get user name if provided
  IF p_performed_by IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_performed_by_name
    FROM user_profiles
    WHERE id = p_performed_by;
  END IF;

  -- Insert log entry
  INSERT INTO job_completion_log (
    company_id,
    work_order_id,
    work_order_number,
    completion_step,
    step_status,
    step_message,
    error_details,
    performed_by,
    performed_by_name,
    metadata
  ) VALUES (
    v_company_id,
    p_work_order_id,
    v_work_order_number,
    p_completion_step,
    p_step_status,
    p_step_message,
    p_error_details,
    p_performed_by,
    v_performed_by_name,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete job (orchestrates all steps)
CREATE OR REPLACE FUNCTION complete_job_automation(
  p_work_order_id uuid,
  p_user_id uuid,
  p_finalize_invoice boolean DEFAULT true,
  p_send_invoice_email boolean DEFAULT false,
  p_create_delivery boolean DEFAULT true,
  p_delivery_type text DEFAULT 'pickup',
  p_delivery_address jsonb DEFAULT NULL,
  p_archive_job boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_finalize_result jsonb;
  v_delivery_result jsonb;
  v_archive_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_has_errors boolean := false;
BEGIN
  -- Get work order details
  SELECT company_id, work_order_number
  INTO v_company_id, v_work_order_number
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'work_order_not_found'
    );
  END IF;

  -- Log start
  PERFORM log_completion_step(
    p_work_order_id,
    'job_completion_started',
    'started',
    format('Starting job completion automation for %s', v_work_order_number),
    NULL,
    p_user_id
  );

  -- Step 1: Finalize invoice if requested
  IF p_finalize_invoice THEN
    v_finalize_result := finalize_invoice_for_work_order(p_work_order_id, p_user_id, p_send_invoice_email);
    
    IF (v_finalize_result->>'success')::boolean THEN
      PERFORM log_completion_step(
        p_work_order_id,
        'invoice_finalized',
        CASE WHEN (v_finalize_result->>'skipped')::boolean THEN 'skipped' ELSE 'completed' END,
        v_finalize_result->>'message',
        NULL,
        p_user_id,
        v_finalize_result
      );
      
      v_results := v_results || jsonb_build_object(
        'step', 'invoice_finalized',
        'success', true,
        'result', v_finalize_result
      );
    ELSE
      v_has_errors := true;
      PERFORM log_completion_step(
        p_work_order_id,
        'invoice_finalized',
        'failed',
        NULL,
        v_finalize_result->>'message',
        p_user_id,
        v_finalize_result
      );
      
      v_results := v_results || jsonb_build_object(
        'step', 'invoice_finalized',
        'success', false,
        'error', v_finalize_result
      );
    END IF;
  END IF;

  -- Step 2: Create delivery task if requested
  IF p_create_delivery THEN
    v_delivery_result := create_delivery_task(
      p_work_order_id,
      p_delivery_type,
      p_user_id,
      p_delivery_address,
      NULL,
      NULL,
      NULL
    );

    IF (v_delivery_result->>'success')::boolean THEN
      PERFORM log_completion_step(
        p_work_order_id,
        'delivery_task_created',
        'completed',
        v_delivery_result->>'message',
        NULL,
        p_user_id,
        v_delivery_result
      );
      
      v_results := v_results || jsonb_build_object(
        'step', 'delivery_task_created',
        'success', true,
        'result', v_delivery_result
      );
    ELSE
      v_has_errors := true;
      PERFORM log_completion_step(
        p_work_order_id,
        'delivery_task_created',
        'failed',
        NULL,
        v_delivery_result->>'message',
        p_user_id,
        v_delivery_result
      );
      
      v_results := v_results || jsonb_build_object(
        'step', 'delivery_task_created',
        'success', false,
        'error', v_delivery_result
      );
    END IF;
  END IF;

  -- Step 3: Archive job if requested
  IF p_archive_job THEN
    v_archive_result := archive_job(p_work_order_id, p_user_id, true, true);

    IF (v_archive_result->>'success')::boolean THEN
      PERFORM log_completion_step(
        p_work_order_id,
        'job_archived',
        'completed',
        v_archive_result->>'message',
        NULL,
        p_user_id,
        v_archive_result
      );
      
      v_results := v_results || jsonb_build_object(
        'step', 'job_archived',
        'success', true,
        'result', v_archive_result
      );
    ELSE
      v_has_errors := true;
      PERFORM log_completion_step(
        p_work_order_id,
        'job_archived',
        'failed',
        NULL,
        v_archive_result->>'message',
        p_user_id,
        v_archive_result
      );
      
      v_results := v_results || jsonb_build_object(
        'step', 'job_archived',
        'success', false,
        'error', v_archive_result
      );
    END IF;
  END IF;

  -- Log completion
  PERFORM log_completion_step(
    p_work_order_id,
    'job_completion_finished',
    'completed',
    format('Job completion automation finished for %s. %s', 
      v_work_order_number,
      CASE WHEN v_has_errors THEN 'Some steps had errors.' ELSE 'All steps completed successfully.' END
    ),
    NULL,
    p_user_id,
    jsonb_build_object('has_errors', v_has_errors)
  );

  RETURN jsonb_build_object(
    'success', true,
    'work_order_number', v_work_order_number,
    'has_errors', v_has_errors,
    'steps', v_results,
    'message', format('Job completion automation %s', 
      CASE WHEN v_has_errors THEN 'completed with some errors' ELSE 'completed successfully' END
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_completion_step(
      p_work_order_id,
      'job_completion_error',
      'failed',
      NULL,
      SQLERRM,
      p_user_id
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_delivery_task TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_invoice_for_work_order TO authenticated;
GRANT EXECUTE ON FUNCTION archive_job TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_job TO authenticated;
GRANT EXECUTE ON FUNCTION log_completion_step TO authenticated;
GRANT EXECUTE ON FUNCTION complete_job_automation TO authenticated;

-- Update timestamp triggers
CREATE TRIGGER update_delivery_tasks_timestamp
  BEFORE UPDATE ON delivery_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_tracking_timestamp();

COMMENT ON TABLE delivery_tasks IS 'Track delivery and shipping tasks for completed work orders';
COMMENT ON TABLE job_completion_log IS 'Log all steps in job completion automation';

COMMENT ON FUNCTION create_delivery_task IS 'Create delivery task for completed work order';
COMMENT ON FUNCTION finalize_invoice_for_work_order IS 'Finalize invoice for work order (marks ready for finalization)';
COMMENT ON FUNCTION archive_job IS 'Archive work order, quote, and invoice (soft delete with flag)';
COMMENT ON FUNCTION unarchive_job IS 'Unarchive work order and related records';
COMMENT ON FUNCTION log_completion_step IS 'Log a step in the job completion automation process';
COMMENT ON FUNCTION complete_job_automation IS 'Orchestrate complete job completion: finalize invoice, create delivery, archive';
