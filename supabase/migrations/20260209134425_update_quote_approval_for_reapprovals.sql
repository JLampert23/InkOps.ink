/*
  # Update Quote Approval to Handle Re-Approvals
  
  1. Changes
    - Modify `process_quote_approval()` function to detect re-approvals
    - When a quote is edited and re-approved:
      - UPDATE existing Work Order (preserve WO number)
      - UPDATE existing Invoice (preserve INV number)
      - Refresh all line items in both
      - Update Garment Purchase Report staging
      - Update Production Schedule entries
      - Add revision log entry
  
  2. Preservation
    - Quote number (QTE-####)
    - Work Order number (WO-####)
    - Invoice number (INV-####)
  
  3. Purpose
    - Enable editing quotes after approval
    - Ensure downstream modules reflect latest quote changes
    - Maintain audit trail with revision logs
*/

-- Drop and recreate the main approval automation function with re-approval support
CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_approval_response RECORD;
  v_work_order_number text;
  v_work_order_id uuid;
  v_invoice_id text;
  v_total_quantity int;
  v_line_item RECORD;
  v_existing_wo_id uuid;
  v_existing_invoice_id text;
  v_is_reapproval boolean := false;
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
    
    -- Check if this is a re-approval (work order already exists)
    SELECT id INTO v_existing_wo_id
    FROM work_orders
    WHERE quote_id = NEW.id
    LIMIT 1;
    
    IF v_existing_wo_id IS NOT NULL THEN
      v_is_reapproval := true;
      
      -- Get existing work order number and invoice ID
      SELECT work_order_number INTO v_work_order_number
      FROM work_orders
      WHERE id = v_existing_wo_id;
      
      SELECT id INTO v_existing_invoice_id
      FROM printavo_invoices
      WHERE raw_data->>'quote_id' = NEW.id::text
      LIMIT 1;
    END IF;
    
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
      CASE WHEN v_is_reapproval THEN 'quote_reapproved' ELSE 'quote_approved' END,
      COALESCE(NEW.approved_by_name, 'System'),
      jsonb_build_object(
        'approved_by_email', NEW.approved_by_email,
        'approved_ip', NEW.approved_ip,
        'approved_at', NEW.approved_at,
        'is_reapproval', v_is_reapproval,
        'was_reopened', COALESCE(NEW.was_reopened, false)
      )
    );
    
    -- Calculate total quantity
    SELECT COALESCE(SUM((qli.quantity)), 0)
    INTO v_total_quantity
    FROM quote_line_items qli
    WHERE qli.quote_id = NEW.id;
    
    -- 4. CREATE OR UPDATE WORK ORDER
    IF v_is_reapproval THEN
      -- UPDATE existing work order
      UPDATE work_orders
      SET
        customer_name = COALESCE(NEW.customer_name, 'Unknown Customer'),
        production_due_date = NEW.production_due_date,
        customer_due_date = NEW.customer_due_date,
        total_quantity = v_total_quantity,
        notes = NEW.notes,
        updated_at = now()
      WHERE id = v_existing_wo_id;
      
      v_work_order_id := v_existing_wo_id;
      
      -- Delete existing work order line items (will recreate)
      DELETE FROM work_order_line_items
      WHERE work_order_id = v_existing_wo_id;
      
      -- Log work order update
      INSERT INTO quote_activity_log (
        quote_id,
        company_id,
        action,
        performed_by_name,
        meta
      ) VALUES (
        NEW.id,
        NEW.company_id,
        'work_order_updated',
        'System',
        jsonb_build_object(
          'work_order_id', v_work_order_id,
          'work_order_number', v_work_order_number,
          'revision_reason', 'Quote edited after approval'
        )
      );
    ELSE
      -- Generate new work order number
      SELECT 'WO-' || to_char(now(), 'YYYYMMDD') || '-' || 
             LPAD(COALESCE(MAX(SUBSTRING(work_order_number FROM '\d+$'))::int, 0) + 1::text, 5, '0')
      INTO v_work_order_number
      FROM work_orders
      WHERE company_id = NEW.company_id
        AND work_order_number LIKE 'WO-' || to_char(now(), 'YYYYMMDD') || '-%';
      
      IF v_work_order_number IS NULL THEN
        v_work_order_number := 'WO-' || to_char(now(), 'YYYYMMDD') || '-00001';
      END IF;
      
      -- Create new work order
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
    END IF;
    
    -- Create/recreate work order line items from quote line items
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
    )
    SELECT
      v_work_order_id,
      NEW.company_id,
      qli.id,
      qli.line_number,
      CASE 
        WHEN qli.line_type = 'garment' THEN 'garment'
        WHEN qli.line_type = 'decoration' THEN 'decoration'
        WHEN qli.line_type = 'custom' THEN 'custom'
        ELSE 'other'
      END,
      qli.description,
      qli.style_number,
      qli.style_name,
      qli.color,
      qli.sizes,
      qli.quantity,
      qli.supplier_type,
      qli.supplier_name,
      qli.garment_images,
      qli.notes
    FROM quote_line_items qli
    WHERE qli.quote_id = NEW.id
    ORDER BY qli.line_number;
    
    -- 5. CREATE OR UPDATE INVOICE
    IF v_is_reapproval AND v_existing_invoice_id IS NOT NULL THEN
      -- UPDATE existing invoice
      UPDATE printavo_invoices
      SET
        customer_email = NEW.customer_email,
        customer_name = NEW.customer_name,
        customer_company = NEW.customer_company,
        customer_phone = NEW.customer_phone,
        subtotal = NEW.subtotal,
        tax = NEW.tax_amount,
        total = NEW.total,
        amount_outstanding = NEW.total - COALESCE(
          (SELECT COALESCE(SUM(amount), 0) 
           FROM payments 
           WHERE invoice_id = v_existing_invoice_id 
             AND status NOT IN ('failed', 'reversed')), 0),
        due_date = COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
        raw_data = jsonb_build_object(
          'source', 'quote_approval',
          'quote_id', NEW.id,
          'quote_number', NEW.quote_number,
          'work_order_id', v_work_order_id,
          'work_order_number', v_work_order_number,
          'line_items', (SELECT jsonb_agg(row_to_json(qli.*)) FROM quote_line_items qli WHERE qli.quote_id = NEW.id)
        ),
        updated_at = now()
      WHERE id = v_existing_invoice_id;
      
      v_invoice_id := v_existing_invoice_id;
      
      -- Delete existing invoice line items (will recreate)
      DELETE FROM invoice_line_items
      WHERE invoice_id = v_existing_invoice_id;
      
      -- Log invoice update
      INSERT INTO quote_activity_log (
        quote_id,
        company_id,
        action,
        performed_by_name,
        meta
      ) VALUES (
        NEW.id,
        NEW.company_id,
        'invoice_updated',
        'System',
        jsonb_build_object(
          'invoice_id', v_invoice_id,
          'invoice_number', v_invoice_id,
          'revision_reason', 'Quote edited after approval'
        )
      );
    ELSE
      -- Generate new invoice ID
      v_invoice_id := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || 
                      LPAD(COALESCE((SELECT COUNT(*) FROM printavo_invoices WHERE invoice_date::date = CURRENT_DATE) + 1, 1)::text, 5, '0');
      
      -- Create new invoice
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
          'line_items', (SELECT jsonb_agg(row_to_json(qli.*)) FROM quote_line_items qli WHERE qli.quote_id = NEW.id)
        )
      );
      
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
    END IF;
    
    -- Create/recreate invoice line items from quote line items
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
    )
    SELECT
      v_invoice_id,
      NEW.company_id,
      qli.id,
      qli.line_number,
      CASE 
        WHEN qli.line_type = 'garment' THEN 'garment'
        WHEN qli.line_type = 'decoration' THEN 'decoration'
        WHEN qli.line_type = 'custom' THEN 'custom'
        WHEN qli.line_type = 'fee' THEN 'fee'
        WHEN qli.line_type = 'discount' THEN 'discount'
        ELSE 'other'
      END,
      qli.description,
      qli.style_number,
      qli.style_name,
      qli.color,
      qli.sizes,
      qli.quantity,
      qli.unit_price,
      qli.subtotal,
      0, -- tax_rate (can be enhanced later)
      0, -- tax_amount (can be enhanced later)
      qli.total,
      0, -- discount_percentage (can be enhanced later)
      0, -- discount_amount (can be enhanced later)
      qli.notes
    FROM quote_line_items qli
    WHERE qli.quote_id = NEW.id
    ORDER BY qli.line_number;
    
    -- Update quote with converted status
    NEW.converted_at := now();
    NEW.production_job_id := v_work_order_id;
    
    -- 6. STAGE/UPDATE GARMENT REQUIREMENTS FOR PO CREATION
    IF v_is_reapproval THEN
      -- Delete existing garment requirements
      DELETE FROM garment_requirements_staging
      WHERE quote_id = NEW.id;
    END IF;
    
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
      CASE WHEN v_is_reapproval THEN 'garment_requirements_updated' ELSE 'garment_requirements_staged' END,
      'System',
      jsonb_build_object(
        'requirements_count', (
          SELECT COUNT(*) 
          FROM garment_requirements_staging 
          WHERE quote_id = NEW.id
        )
      )
    );
    
    -- 7. PUSH/UPDATE IMPRINTS TO SCHEDULER
    IF v_is_reapproval THEN
      -- Delete existing production schedule entries
      DELETE FROM production_schedule_entries
      WHERE quote_id = NEW.id;
    END IF;
    
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
    
    -- Log scheduler push/update
    INSERT INTO quote_activity_log (
      quote_id,
      company_id,
      action,
      performed_by_name,
      meta
    ) VALUES (
      NEW.id,
      NEW.company_id,
      CASE WHEN v_is_reapproval THEN 'scheduler_entries_updated' ELSE 'scheduler_entries_created' END,
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

-- Comment for documentation
COMMENT ON FUNCTION process_quote_approval() IS 'Comprehensive automation triggered on quote approval. Handles both initial approvals and re-approvals. Updates work orders, invoices, garment requirements, and scheduler entries when quotes are edited after approval.';
