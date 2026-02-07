/*
  # Fix line type mapping in process_quote_approval trigger

  - Work order line items: skip 'fee' lines (not production items),
    map 'item' -> 'garment'
  - Invoice line items: map 'item' -> 'garment', keep 'fee' as 'fee'
  - Garment requirements: only stage actual garment lines (not fees)
*/

CREATE OR REPLACE FUNCTION public.process_quote_approval()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_approval_response RECORD;
  v_work_order_number text;
  v_work_order_id uuid;
  v_invoice_id text;
  v_total_quantity int;
  v_line_item RECORD;
  v_imprint RECORD;
  v_department text;
  v_artwork_url text;
  v_next_wo_num int;
  v_mapped_item_type text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN

    NEW.is_locked := true;

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

    INSERT INTO quote_activity_log (
      quote_id, company_id, action, performed_by_name, meta
    ) VALUES (
      NEW.id, NEW.company_id, 'quote_approved',
      COALESCE(NEW.approved_by_name, 'System'),
      jsonb_build_object(
        'approved_by_email', NEW.approved_by_email,
        'approved_ip', NEW.approved_ip,
        'approved_at', NEW.approved_at
      )
    );

    SELECT COALESCE(SUM(COALESCE(total_quantity, quantity, 0)), 0)
    INTO v_total_quantity
    FROM quote_line_items
    WHERE quote_id = NEW.id AND COALESCE(line_type, 'item') != 'fee';

    -- CREATE WORK ORDER
    SELECT COALESCE(MAX(SUBSTRING(work_order_number FROM '\d+$')::int), 0) + 1
    INTO v_next_wo_num
    FROM work_orders
    WHERE company_id = NEW.company_id
    AND work_order_number LIKE 'WO-' || to_char(now(), 'YYYYMMDD') || '-%';

    v_work_order_number := 'WO-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(v_next_wo_num::text, 5, '0');

    INSERT INTO work_orders (
      work_order_number, company_id, quote_id, customer_id, customer_name,
      status, priority, production_due_date, customer_due_date, total_quantity, notes
    ) VALUES (
      v_work_order_number, NEW.company_id, NEW.id, NEW.customer_id,
      COALESCE(NEW.customer_name, 'Unknown Customer'),
      'draft', 'medium', NEW.production_due_date, NEW.customer_due_date,
      v_total_quantity, NEW.notes
    )
    RETURNING id INTO v_work_order_id;

    -- WORK ORDER LINE ITEMS (skip fees - not production items)
    FOR v_line_item IN
      SELECT
        id, line_number, line_type, description, item_number, brand,
        color, regular_sizes,
        COALESCE(total_quantity, quantity, 0) as qty,
        supplier_name, garment_images_data, notes
      FROM quote_line_items
      WHERE quote_id = NEW.id
      AND COALESCE(line_type, 'item') != 'fee'
      ORDER BY COALESCE(sort_order, line_number)
    LOOP
      v_mapped_item_type := CASE
        WHEN v_line_item.line_type = 'decoration' THEN 'decoration'
        WHEN v_line_item.line_type = 'custom' THEN 'custom'
        ELSE 'garment'
      END;

      INSERT INTO work_order_line_items (
        work_order_id, company_id, quote_line_item_id, line_number,
        item_type, description, style_number, style_name, color, sizes,
        quantity, supplier_type, supplier_name, garment_images, notes
      ) VALUES (
        v_work_order_id, NEW.company_id, v_line_item.id, v_line_item.line_number,
        v_mapped_item_type, v_line_item.description, v_line_item.item_number,
        v_line_item.brand, v_line_item.color, v_line_item.regular_sizes,
        v_line_item.qty, NULL, v_line_item.supplier_name,
        v_line_item.garment_images_data, v_line_item.notes
      );
    END LOOP;

    INSERT INTO quote_activity_log (
      quote_id, company_id, action, performed_by_name, meta
    ) VALUES (
      NEW.id, NEW.company_id, 'work_order_created', 'System',
      jsonb_build_object(
        'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number,
        'line_items_count', (SELECT COUNT(*) FROM work_order_line_items WHERE work_order_id = v_work_order_id)
      )
    );

    -- CREATE INVOICE
    v_invoice_id := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
      LPAD(COALESCE((SELECT COUNT(*) FROM printavo_invoices WHERE invoice_date::date = CURRENT_DATE) + 1, 1)::text, 5, '0');

    INSERT INTO printavo_invoices (
      id, invoice_number, company_id, customer_email, customer_name,
      customer_company, customer_phone, subtotal, tax, total,
      amount_paid, amount_outstanding, status, status_stage,
      invoice_date, due_date, customer_id, raw_data
    ) VALUES (
      v_invoice_id, v_invoice_id, NEW.company_id, NEW.customer_email,
      NEW.customer_name, NEW.customer_company, NEW.customer_phone,
      NEW.subtotal, NEW.tax_amount, NEW.total, 0, NEW.total,
      'Open', 'unpaid', CURRENT_DATE,
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

    -- INVOICE LINE ITEMS (include fees)
    FOR v_line_item IN
      SELECT
        id, line_number, line_type, description, item_number, brand,
        color, regular_sizes,
        COALESCE(total_quantity, quantity, 0) as qty,
        unit_price, total_price, notes
      FROM quote_line_items
      WHERE quote_id = NEW.id
      ORDER BY COALESCE(sort_order, line_number)
    LOOP
      v_mapped_item_type := CASE
        WHEN v_line_item.line_type = 'fee' THEN 'fee'
        WHEN v_line_item.line_type = 'decoration' THEN 'decoration'
        WHEN v_line_item.line_type = 'custom' THEN 'custom'
        WHEN v_line_item.line_type = 'discount' THEN 'discount'
        ELSE 'garment'
      END;

      INSERT INTO invoice_line_items (
        invoice_id, company_id, quote_line_item_id, line_number,
        item_type, description, style_number, style_name, color, sizes,
        quantity, unit_price, subtotal, tax_rate, tax_amount, total,
        discount_percentage, discount_amount, notes
      ) VALUES (
        v_invoice_id, NEW.company_id, v_line_item.id, v_line_item.line_number,
        v_mapped_item_type, v_line_item.description, v_line_item.item_number,
        v_line_item.brand, v_line_item.color, v_line_item.regular_sizes,
        v_line_item.qty, v_line_item.unit_price, v_line_item.total_price,
        0, 0, v_line_item.total_price, 0, 0, v_line_item.notes
      );
    END LOOP;

    NEW.converted_at := now();
    NEW.production_job_id := v_work_order_id;

    INSERT INTO quote_activity_log (
      quote_id, company_id, action, performed_by_name, meta
    ) VALUES (
      NEW.id, NEW.company_id, 'invoice_created', 'System',
      jsonb_build_object(
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_id,
        'line_items_count', (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = v_invoice_id)
      )
    );

    -- STAGE GARMENT REQUIREMENTS (only actual garments, not fees)
    FOR v_line_item IN
      SELECT
        qli.id as line_item_id, qli.supplier_name, qli.item_number,
        qli.brand, qli.color, qli.regular_sizes,
        COALESCE(qli.total_quantity, qli.quantity, 0) as qty,
        qli.unit_price
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id
      AND qli.item_number IS NOT NULL
      AND COALESCE(qli.line_type, 'item') != 'fee'
    LOOP
      INSERT INTO garment_requirements_staging (
        company_id, quote_id, work_order_id, supplier_type, supplier_name,
        style_number, style_name, color, sizes, total_quantity,
        unit_cost, total_cost, is_po_created
      ) VALUES (
        NEW.company_id, NEW.id, v_work_order_id, NULL,
        v_line_item.supplier_name, v_line_item.item_number,
        v_line_item.brand, v_line_item.color, v_line_item.regular_sizes,
        v_line_item.qty, v_line_item.unit_price,
        v_line_item.qty * COALESCE(v_line_item.unit_price, 0), false
      );
    END LOOP;

    INSERT INTO quote_activity_log (
      quote_id, company_id, action, performed_by_name, meta
    ) VALUES (
      NEW.id, NEW.company_id, 'garment_requirements_staged', 'System',
      jsonb_build_object(
        'requirements_count', (
          SELECT COUNT(*) FROM garment_requirements_staging WHERE quote_id = NEW.id
        )
      )
    );

    -- PUSH IMPRINTS TO SCHEDULER
    FOR v_imprint IN
      SELECT
        qi.id as imprint_id, qi.type_of_work, qi.imprint_number,
        qi.mockups, qi.thread_ink_color
      FROM quote_imprints qi
      WHERE qi.quote_id = NEW.id
    LOOP
      v_department := CASE
        WHEN LOWER(v_imprint.type_of_work) LIKE '%screen%' THEN 'screen_printing'
        WHEN LOWER(v_imprint.type_of_work) LIKE '%embroid%' THEN 'embroidery'
        WHEN LOWER(v_imprint.type_of_work) LIKE '%dtg%' OR LOWER(v_imprint.type_of_work) LIKE '%direct%' THEN 'dtg'
        WHEN LOWER(v_imprint.type_of_work) LIKE '%vinyl%' OR LOWER(v_imprint.type_of_work) LIKE '%htv%' THEN 'vinyl'
        ELSE 'general'
      END;

      v_artwork_url := NULL;
      IF v_imprint.mockups IS NOT NULL AND jsonb_array_length(v_imprint.mockups) > 0 THEN
        v_artwork_url := v_imprint.mockups->0->>'url';
        IF v_artwork_url IS NULL THEN
          v_artwork_url := v_imprint.mockups->>0;
        END IF;
      END IF;

      INSERT INTO production_schedule_entries (
        company_id, quote_id, work_order_id, imprint_id, type_of_work,
        imprint_number, artwork_thumb_url, production_due_date, quantity,
        step_statuses, priority_order, customer_name, quote_number,
        colors, estimated_runtime, department, notes
      ) VALUES (
        NEW.company_id, NEW.id, v_work_order_id, v_imprint.imprint_id,
        v_imprint.type_of_work, v_imprint.imprint_number, v_artwork_url,
        COALESCE(NEW.production_due_date, NEW.customer_due_date, CURRENT_DATE + INTERVAL '7 days'),
        v_total_quantity, '{}'::jsonb, 0,
        COALESCE(NEW.customer_name, 'Unknown'), NEW.quote_number,
        v_imprint.thread_ink_color, 0, v_department, NEW.notes
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    INSERT INTO quote_activity_log (
      quote_id, company_id, action, performed_by_name, meta
    ) VALUES (
      NEW.id, NEW.company_id, 'scheduler_entries_created', 'System',
      jsonb_build_object(
        'schedule_entries_count', (
          SELECT COUNT(*) FROM production_schedule_entries WHERE quote_id = NEW.id
        )
      )
    );

  END IF;

  RETURN NEW;
END;
$function$;
