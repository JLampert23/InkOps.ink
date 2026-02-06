/*
  # Enhance Invoice Creation with Line Items

  1. Updates
    - Modify `process_quote_approval()` to populate invoice line items
    - Copy all pricing information from quote
    - Include discounts, taxes, and fees
    - Enable detailed itemized invoices

  2. Purpose
    - Provide complete invoice line item detail
    - Support PDF generation with full breakdown
    - Maintain pricing audit trail
*/

-- Drop and recreate the approval automation function with invoice line item population
DROP FUNCTION IF EXISTS process_quote_approval() CASCADE;

CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_approval_response RECORD;
  v_work_order_number text;
  v_work_order_id uuid;
  v_invoice_id text;
  v_total_quantity int;
  v_line_item RECORD;
  v_default_workflow_column text;
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- 1. LOCK THE QUOTE
    NEW.is_locked := true;
    
    -- 2. CAPTURE APPROVAL METADATA
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
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_quantity
    FROM quote_line_items
    WHERE quote_id = NEW.id;
    
    -- Get default workflow column
    SELECT column_name
    INTO v_default_workflow_column
    FROM production_workflow_columns
    WHERE company_id = NEW.company_id
      AND is_default = true
    ORDER BY column_order
    LIMIT 1;
    
    IF v_default_workflow_column IS NULL THEN
      v_default_workflow_column := 'Pending Scheduling';
    END IF;
    
    -- 4. CREATE WORK ORDER
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
      v_default_workflow_column,
      'medium',
      NEW.production_due_date,
      NEW.customer_due_date,
      v_total_quantity,
      NEW.notes
    )
    RETURNING id INTO v_work_order_id;
    
    -- 4a. POPULATE WORK ORDER LINE ITEMS (without pricing)
    FOR v_line_item IN 
      SELECT 
        id,
        line_number,
        item_type,
        description,
        style_number,
        style_name,
        color,
        sizes,
        quantity,
        supplier_type,
        supplier_name,
        garment_images,
        notes
      FROM quote_line_items
      WHERE quote_id = NEW.id
      ORDER BY line_number
    LOOP
      INSERT INTO work_order_line_items (
        work_order_id,
        company_id,
        quote_line_item_id,
        line_number,
        item_type,
        description,
        style_number,
        style_name,
        color,
        sizes,
        quantity,
        supplier_type,
        supplier_name,
        garment_images,
        notes
      ) VALUES (
        v_work_order_id,
        NEW.company_id,
        v_line_item.id,
        v_line_item.line_number,
        v_line_item.item_type,
        v_line_item.description,
        v_line_item.style_number,
        v_line_item.style_name,
        v_line_item.color,
        v_line_item.sizes,
        v_line_item.quantity,
        v_line_item.supplier_type,
        v_line_item.supplier_name,
        v_line_item.garment_images,
        v_line_item.notes
      );
    END LOOP;
    
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
        'work_order_number', v_work_order_number,
        'line_items_count', (SELECT COUNT(*) FROM work_order_line_items WHERE work_order_id = v_work_order_id)
      )
    );
    
    -- 5. CREATE INVOICE WITH LINE ITEMS
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
        'work_order_number', v_work_order_number
      )
    );
    
    -- 5a. POPULATE INVOICE LINE ITEMS (with pricing)
    FOR v_line_item IN 
      SELECT 
        id,
        line_number,
        item_type,
        description,
        style_number,
        style_name,
        color,
        sizes,
        quantity,
        unit_price,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        discount_percentage,
        discount_amount,
        notes
      FROM quote_line_items
      WHERE quote_id = NEW.id
      ORDER BY line_number
    LOOP
      INSERT INTO invoice_line_items (
        invoice_id,
        company_id,
        quote_line_item_id,
        line_number,
        item_type,
        description,
        style_number,
        style_name,
        color,
        sizes,
        quantity,
        unit_price,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        discount_percentage,
        discount_amount,
        notes
      ) VALUES (
        v_invoice_id,
        NEW.company_id,
        v_line_item.id,
        v_line_item.line_number,
        v_line_item.item_type,
        v_line_item.description,
        v_line_item.style_number,
        v_line_item.style_name,
        v_line_item.color,
        v_line_item.sizes,
        v_line_item.quantity,
        v_line_item.unit_price,
        v_line_item.subtotal,
        COALESCE(v_line_item.tax_rate, 0),
        COALESCE(v_line_item.tax_amount, 0),
        v_line_item.total,
        COALESCE(v_line_item.discount_percentage, 0),
        COALESCE(v_line_item.discount_amount, 0),
        v_line_item.notes
      );
    END LOOP;
    
    -- Copy invoice-level fees if any
    IF NEW.fees_data IS NOT NULL AND jsonb_array_length(NEW.fees_data) > 0 THEN
      INSERT INTO invoice_line_items (
        invoice_id,
        company_id,
        line_number,
        item_type,
        description,
        quantity,
        unit_price,
        subtotal,
        tax_rate,
        tax_amount,
        total
      )
      SELECT
        v_invoice_id,
        NEW.company_id,
        1000 + ROW_NUMBER() OVER (),
        'fee',
        fee->>'name',
        1,
        (fee->>'amount')::numeric,
        (fee->>'amount')::numeric,
        COALESCE((fee->>'tax_rate')::numeric, 0),
        COALESCE((fee->>'tax_amount')::numeric, 0),
        (fee->>'amount')::numeric + COALESCE((fee->>'tax_amount')::numeric, 0)
      FROM jsonb_array_elements(NEW.fees_data) AS fee;
    END IF;
    
    NEW.converted_at := now();
    NEW.production_job_id := v_work_order_id;
    
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
        'invoice_number', v_invoice_id,
        'line_items_count', (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = v_invoice_id)
      )
    );
    
    -- 6. STAGE GARMENT REQUIREMENTS FOR PO CREATION
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

-- Recreate trigger
CREATE TRIGGER trigger_comprehensive_quote_approval
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION process_quote_approval();

COMMENT ON FUNCTION process_quote_approval() IS 'Comprehensive automation: locks quote, captures metadata, creates work order with line items, invoice with line items, stages POs, pushes to scheduler';
