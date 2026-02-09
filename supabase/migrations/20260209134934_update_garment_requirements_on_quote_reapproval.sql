/*
  # Update Garment Requirements Logic for Quote Re-approvals

  1. Changes
    - Replace simple DELETE with smart update logic
    - Preserve items already on POs and flag them for review
    - Delete only items NOT on POs
    - Insert fresh requirements from updated quote
    - Track changes with detailed metadata

  2. Behavior
    - Items on POs: Flag as "requires_review" with change reason
    - Items NOT on POs: Delete and replace with new data
    - All new items: Inserted fresh from quote line items
    - Activity log: Records update vs create separately
*/

-- Drop the existing trigger to replace it
DROP TRIGGER IF EXISTS process_quote_approval ON quotes;

-- Replace the quote approval function with enhanced garment requirements handling
CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_id uuid;
  v_work_order_number text;
  v_invoice_id text;
  v_existing_invoice_id text;
  v_is_reapproval boolean := false;
  v_line_item RECORD;
  v_existing_requirement RECORD;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Check if this is a re-approval (work order already exists)
    SELECT id, work_order_number INTO v_work_order_id, v_work_order_number
    FROM work_orders
    WHERE quote_id = NEW.id
    LIMIT 1;
    
    IF v_work_order_id IS NOT NULL THEN
      v_is_reapproval := true;
    END IF;
    
    -- 1. FIND EXISTING INVOICE (if re-approval)
    IF v_is_reapproval THEN
      SELECT id INTO v_existing_invoice_id
      FROM printavo_invoices
      WHERE raw_data->>'quote_id' = NEW.id::text
      LIMIT 1;
    END IF;
    
    -- 2. CREATE OR UPDATE WORK ORDER
    IF v_is_reapproval THEN
      -- Update existing work order
      UPDATE work_orders
      SET
        customer_name = NEW.customer_name,
        customer_company = NEW.customer_company,
        due_date = NEW.delivery_date,
        notes = NEW.notes,
        updated_at = now()
      WHERE id = v_work_order_id;
      
      -- Delete existing work order line items
      DELETE FROM work_order_line_items
      WHERE work_order_id = v_work_order_id;
      
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
          'work_order_number', v_work_order_number
        )
      );
    ELSE
      -- Generate work order number
      v_work_order_number := 'WO-' || LPAD(
        COALESCE(
          (SELECT MAX(CAST(SUBSTRING(work_order_number FROM 'WO-(\d+)') AS INTEGER)) FROM work_orders WHERE company_id = NEW.company_id),
          0
        ) + 1,
        6,
        '0'
      );
      
      -- Create new work order
      INSERT INTO work_orders (
        work_order_number,
        quote_id,
        customer_name,
        customer_company,
        status,
        due_date,
        notes,
        company_id
      ) VALUES (
        v_work_order_number,
        NEW.id,
        NEW.customer_name,
        NEW.customer_company,
        'pending_scheduling',
        NEW.delivery_date,
        NEW.notes,
        NEW.company_id
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
    
    -- 3. CREATE WORK ORDER LINE ITEMS
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
    
    -- 4. CREATE OR UPDATE INVOICE
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
    
    -- 5. CREATE/RECREATE INVOICE LINE ITEMS
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
      0,
      0,
      qli.total,
      0,
      0,
      qli.notes
    FROM quote_line_items qli
    WHERE qli.quote_id = NEW.id
    ORDER BY qli.line_number;
    
    -- Update quote with converted status
    NEW.converted_at := now();
    NEW.production_job_id := v_work_order_id;
    
    -- 6. SMART UPDATE OF GARMENT REQUIREMENTS
    IF v_is_reapproval THEN
      -- For re-approvals, handle items on POs differently from items not on POs
      
      -- First, flag items that are on POs and preserve them
      FOR v_existing_requirement IN
        SELECT *
        FROM garment_requirements_staging
        WHERE quote_id = NEW.id
          AND is_po_created = true
          AND po_id IS NOT NULL
      LOOP
        -- Store original data for comparison
        UPDATE garment_requirements_staging
        SET
          requires_review = true,
          change_reason = 'Quote edited after PO created - Manual review required',
          original_data = jsonb_build_object(
            'style_number', v_existing_requirement.style_number,
            'style_name', v_existing_requirement.style_name,
            'color', v_existing_requirement.color,
            'sizes', v_existing_requirement.sizes,
            'total_quantity', v_existing_requirement.total_quantity,
            'unit_cost', v_existing_requirement.unit_cost,
            'supplier_type', v_existing_requirement.supplier_type,
            'supplier_name', v_existing_requirement.supplier_name
          ),
          updated_at = now()
        WHERE id = v_existing_requirement.id;
      END LOOP;
      
      -- Delete only requirements NOT on POs
      DELETE FROM garment_requirements_staging
      WHERE quote_id = NEW.id
        AND (is_po_created = false OR po_id IS NULL);
      
      -- Log the flagging action
      INSERT INTO quote_activity_log (
        quote_id,
        company_id,
        action,
        performed_by_name,
        meta
      ) VALUES (
        NEW.id,
        NEW.company_id,
        'garment_requirements_flagged_for_review',
        'System',
        jsonb_build_object(
          'flagged_count', (
            SELECT COUNT(*) 
            FROM garment_requirements_staging 
            WHERE quote_id = NEW.id 
              AND requires_review = true
          )
        )
      );
    END IF;
    
    -- Insert fresh garment requirements from updated quote
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
        is_po_created,
        requires_review,
        change_reason
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
        false,
        false,
        NULL
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
        'new_requirements_count', (
          SELECT COUNT(*) 
          FROM garment_requirements_staging 
          WHERE quote_id = NEW.id
            AND requires_review = false
        ),
        'flagged_requirements_count', (
          SELECT COUNT(*) 
          FROM garment_requirements_staging 
          WHERE quote_id = NEW.id
            AND requires_review = true
        )
      )
    );
    
    -- 7. ADD TO BILLING QUEUE
    INSERT INTO billing_queue (
      company_id,
      invoice_id,
      customer_email,
      customer_name,
      amount_due,
      due_date,
      status
    ) VALUES (
      NEW.company_id,
      v_invoice_id,
      NEW.customer_email,
      NEW.customer_name,
      NEW.total,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      'pending'
    )
    ON CONFLICT (invoice_id) DO UPDATE
    SET
      amount_due = EXCLUDED.amount_due,
      due_date = EXCLUDED.due_date,
      updated_at = now();
    
    -- 8. CREATE SCHEDULER ENTRY
    INSERT INTO production_schedule_entries (
      company_id,
      work_order_id,
      quote_id,
      customer_name,
      due_date,
      status,
      scheduler_tab_id
    ) VALUES (
      NEW.company_id,
      v_work_order_id,
      NEW.id,
      NEW.customer_name,
      NEW.delivery_date,
      'pending',
      (SELECT id FROM scheduler_tabs WHERE company_id = NEW.company_id AND is_default = true LIMIT 1)
    )
    ON CONFLICT (work_order_id) DO UPDATE
    SET
      customer_name = EXCLUDED.customer_name,
      due_date = EXCLUDED.due_date,
      updated_at = now();
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER process_quote_approval
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION process_quote_approval();
