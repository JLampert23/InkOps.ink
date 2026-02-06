/*
  # Comprehensive Quote Approval Automation

  1. Functions
    - `process_quote_approval()` - Main automation function triggered on quote approval
    - Orchestrates all downstream actions:
      a) Lock the quote
      b) Capture approval metadata
      c) Create activity log entry
      d) Create work order
      e) Create invoice (Printavo format)
      f) Stage garment requirements for PO creation
      g) Push imprints to scheduler (already handled by existing trigger)

  2. Triggers
    - After update on quotes table when status changes to 'approved'
    - Executes comprehensive approval workflow

  3. Purpose
    - Automate entire quote-to-production workflow
    - Ensure data consistency and audit trail
    - Reduce manual steps and errors
*/

-- Drop existing trigger if it exists (we'll recreate it with expanded functionality)
DROP TRIGGER IF EXISTS trigger_create_schedule_on_approval ON quotes;

-- Main approval automation function
CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_approval_response RECORD;
  v_work_order_number text;
  v_work_order_id uuid;
  v_invoice_id text;
  v_total_quantity int;
  v_line_item RECORD;
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- 1. LOCK THE QUOTE
    NEW.is_locked := true;
    
    -- 2. CAPTURE APPROVAL METADATA
    -- Get approval metadata from most recent approval response
    SELECT 
      approver_name,
      approver_email,
      ip_address
    INTO v_approval_response
    FROM quote_approval_responses qar
    JOIN quote_approvals qa ON qar.approval_id = qa.id
    WHERE qa.quote_id = NEW.id
      AND qar.approved = true
    ORDER BY qar.responded_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      NEW.approved_by_name := v_approval_response.approver_name;
      NEW.approved_by_email := v_approval_response.approver_email;
      NEW.approved_ip := v_approval_response.ip_address;
    END IF;
    
    -- Set approval timestamp
    NEW.approved_at := now();
    
    -- 3. CREATE ACTIVITY LOG ENTRY
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by_name,
      meta
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'quote_approved',
      COALESCE(NEW.approved_by_name, 'System'),
      jsonb_build_object(
        'approved_by_email', NEW.approved_by_email,
        'approved_ip', NEW.approved_ip,
        'approved_at', NEW.approved_at
      )
    );
    
    -- Calculate total quantity
    SELECT COALESCE(SUM((li->>'quantity')::int), 0)
    INTO v_total_quantity
    FROM jsonb_array_elements(COALESCE(NEW.line_items, '[]'::jsonb)) AS li;
    
    -- 4. CREATE WORK ORDER
    -- Generate work order number (WO-YYYYMMDD-XXXXX format)
    SELECT 'WO-' || to_char(now(), 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(MAX(SUBSTRING(work_order_number FROM '\d+$'))::int, 0) + 1::text, 5, '0')
    INTO v_work_order_number
    FROM work_orders
    WHERE company_id = NEW.company_id
      AND work_order_number LIKE 'WO-' || to_char(now(), 'YYYYMMDD') || '-%';
    
    IF v_work_order_number IS NULL THEN
      v_work_order_number := 'WO-' || to_char(now(), 'YYYYMMDD') || '-00001';
    END IF;
    
    INSERT INTO work_orders (
      work_order_number,
      company_id,
      quote_id,
      customer_id,
      customer_name,
      status,
      priority,
      production_due_date,
      customer_due_date,
      total_quantity,
      notes
    ) VALUES (
      v_work_order_number,
      NEW.company_id,
      NEW.id,
      NEW.customer_id,
      COALESCE(NEW.customer_name, 'Unknown Customer'),
      'draft',
      'medium',
      NEW.production_due_date,
      NEW.customer_due_date,
      v_total_quantity,
      NEW.notes
    )
    RETURNING id INTO v_work_order_id;
    
    -- Log work order creation
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by_name,
      meta
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'work_order_created',
      'System',
      jsonb_build_object(
        'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number
      )
    );
    
    -- 5. CREATE INVOICE (using printavo_invoices format for compatibility)
    -- Generate invoice ID (match Printavo format)
    v_invoice_id := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || 
                    LPAD(COALESCE((SELECT COUNT(*) FROM printavo_invoices WHERE invoice_date::date = CURRENT_DATE) + 1, 1)::text, 5, '0');
    
    INSERT INTO printavo_invoices (
      id,
      invoice_number,
      customer_email,
      customer_name,
      customer_company,
      customer_phone,
      subtotal,
      tax,
      total,
      amount_paid,
      amount_outstanding,
      status,
      status_stage,
      invoice_date,
      due_date,
      customer_id,
      raw_data
    ) VALUES (
      v_invoice_id,
      v_invoice_id,
      NEW.customer_email,
      NEW.customer_name,
      NEW.customer_company,
      NEW.customer_phone,
      NEW.subtotal,
      NEW.tax_amount,
      NEW.total,
      0,
      NEW.total,
      'Open',
      'unpaid',
      CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      NEW.customer_id,
      jsonb_build_object(
        'source', 'quote_approval',
        'quote_id', NEW.id,
        'quote_number', NEW.quote_number,
        'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number,
        'line_items', NEW.line_items
      )
    );
    
    -- Update quote with converted status
    NEW.converted_at := now();
    NEW.production_job_id := v_work_order_id;
    
    -- Log invoice creation
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by_name,
      meta
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'invoice_created',
      'System',
      jsonb_build_object(
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_id
      )
    );
    
    -- 6. STAGE GARMENT REQUIREMENTS FOR PO CREATION
    -- Extract garment data from quote line items
    FOR v_line_item IN 
      SELECT 
        qli.id as line_item_id,
        qli.supplier_type,
        qli.supplier_name,
        qli.style_number,
        qli.style_name,
        qli.color,
        qli.sizes,
        qli.quantity,
        qli.unit_price
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id
        AND qli.style_number IS NOT NULL
    LOOP
      INSERT INTO garment_requirements_staging (
        company_id,
        quote_id,
        work_order_id,
        supplier_type,
        supplier_name,
        style_number,
        style_name,
        color,
        sizes,
        total_quantity,
        unit_cost,
        total_cost,
        is_po_created
      ) VALUES (
        NEW.company_id,
        NEW.id,
        v_work_order_id,
        v_line_item.supplier_type,
        v_line_item.supplier_name,
        v_line_item.style_number,
        v_line_item.style_name,
        v_line_item.color,
        v_line_item.sizes,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.quantity * v_line_item.unit_price,
        false
      );
    END LOOP;
    
    -- Log garment requirements staging
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by_name,
      meta
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'garment_requirements_staged',
      'System',
      jsonb_build_object(
        'requirements_count', (
          SELECT COUNT(*) 
          FROM garment_requirements_staging 
          WHERE quote_id = NEW.id
        )
      )
    );
    
    -- 7. PUSH IMPRINTS TO SCHEDULER
    -- Create production schedule entries for each imprint
    INSERT INTO production_schedule_entries (
      company_id,
      quote_id,
      line_item_id,
      imprint_id,
      type_of_work,
      imprint_number,
      artwork_thumb_url,
      production_due_date,
      station,
      quantity,
      step_statuses,
      priority_order,
      customer_name,
      quote_number
    )
    SELECT
      NEW.company_id,
      NEW.id,
      qi.line_item_id,
      qi.id,
      qi.type_of_work,
      qi.imprint_number,
      qi.artwork_url,
      COALESCE(NEW.production_due_date, NEW.customer_due_date, CURRENT_DATE + INTERVAL '7 days'),
      NULL,
      COALESCE(qli.quantity, 0),
      '{}'::jsonb,
      0,
      COALESCE(c.customer_name, NEW.customer_name),
      NEW.quote_number
    FROM quote_imprints qi
    LEFT JOIN quote_line_items qli ON qi.line_item_id = qli.id
    LEFT JOIN customers c ON NEW.customer_id = c.id
    WHERE qi.quote_id = NEW.id
    ON CONFLICT DO NOTHING;
    
    -- Log scheduler push
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by_name,
      meta
    ) VALUES (
      NEW.id,
      NEW.company_id,
      'scheduler_entries_created',
      'System',
      jsonb_build_object(
        'schedule_entries_count', (
          SELECT COUNT(*) 
          FROM production_schedule_entries 
          WHERE quote_id = NEW.id
        )
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comprehensive approval automation
CREATE TRIGGER trigger_comprehensive_quote_approval
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION process_quote_approval();

-- Add comment for documentation
COMMENT ON FUNCTION process_quote_approval() IS 'Comprehensive automation triggered on quote approval. Locks quote, captures metadata, creates work order, invoice, stages POs, and pushes to scheduler.';
