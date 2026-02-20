/*
  # Update Invoice Contact to Use Primary Contact Fields

  1. Changes
    - Modifies the process_quote_approval trigger to look up primary_contact_first_name 
      and primary_contact_last_name from customers table when creating invoices
    - Updates existing invoices to use primary contact fields from customers table
    - Ensures customer_name field properly reflects the primary contact's full name

  2. Logic
    - When quote is approved, fetch customer's primary contact names from customers table
    - Concatenate first_name and last_name to create customer_name for invoice
    - Falls back to existing customer_name if primary contact fields are empty
*/

-- First, update existing invoices to use primary contact fields from customers table
UPDATE printavo_invoices pi
SET customer_name = CONCAT(c.primary_contact_first_name, ' ', c.primary_contact_last_name)
FROM customers c
WHERE pi.customer_id = c.id
  AND c.primary_contact_first_name IS NOT NULL
  AND c.primary_contact_last_name IS NOT NULL
  AND (pi.customer_name IS NULL OR pi.customer_name = '' OR pi.customer_name != CONCAT(c.primary_contact_first_name, ' ', c.primary_contact_last_name));

-- Update the quote approval trigger to use primary contact fields
CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
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
  v_quote_num text;
  v_mapped_item_type text;
  v_customer_name text;
  v_customer_company text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN

    NEW.is_locked := true;

    SELECT approver_name, approver_email, ip_address
    INTO v_approval_response
    FROM quote_approval_responses qar
    JOIN quote_approvals qa ON qar.approval_id = qa.id
    WHERE qa.quote_id = NEW.id AND qar.approved = true
    ORDER BY qar.responded_at DESC LIMIT 1;

    IF FOUND THEN
      NEW.approved_by_name := v_approval_response.approver_name;
      NEW.approved_by_email := v_approval_response.approver_email;
      NEW.approved_ip := v_approval_response.ip_address;
    END IF;

    NEW.approved_at := now();

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'quote_approved', COALESCE(NEW.approved_by_name, 'System'),
      jsonb_build_object('approved_by_email', NEW.approved_by_email, 'approved_ip', NEW.approved_ip, 'approved_at', NEW.approved_at));

    -- Fetch primary contact name and company from customers table
    SELECT 
      CONCAT(primary_contact_first_name, ' ', primary_contact_last_name),
      company_name
    INTO v_customer_name, v_customer_company
    FROM customers
    WHERE id = NEW.customer_id;

    -- Fall back to quote's customer_name if not found in customers table
    v_customer_name := COALESCE(NULLIF(TRIM(v_customer_name), ''), NEW.customer_name, 'Unknown Customer');
    v_customer_company := COALESCE(v_customer_company, NEW.customer_company);

    SELECT COALESCE(SUM(COALESCE(total_quantity, quantity, 0)), 0) INTO v_total_quantity
    FROM quote_line_items WHERE quote_id = NEW.id AND COALESCE(line_type, 'item') != 'fee';

    v_quote_num := REGEXP_REPLACE(NEW.quote_number, '[^0-9]', '', 'g');
    v_work_order_number := 'WO-' || v_quote_num;
    v_invoice_id := 'INV-' || v_quote_num;

    INSERT INTO work_orders (
      work_order_number, company_id, quote_id, customer_id, customer_name,
      status, priority, production_due_date, customer_due_date, total_quantity, notes
    ) VALUES (
      v_work_order_number, NEW.company_id, NEW.id, NEW.customer_id,
      v_customer_name,
      'Pending Scheduling', 'medium', NEW.production_due_date, NEW.customer_due_date, v_total_quantity, NEW.notes
    ) RETURNING id INTO v_work_order_id;

    FOR v_line_item IN
      SELECT id, line_number, line_type, description, item_number, brand,
        color, regular_sizes, COALESCE(total_quantity, quantity, 0) as qty,
        supplier_name, garment_images_data, notes
      FROM quote_line_items WHERE quote_id = NEW.id AND COALESCE(line_type, 'item') != 'fee'
      ORDER BY COALESCE(sort_order, line_number)
    LOOP
      v_mapped_item_type := CASE
        WHEN v_line_item.line_type = 'decoration' THEN 'decoration'
        WHEN v_line_item.line_type = 'custom' THEN 'custom'
        ELSE 'garment'
      END;

      INSERT INTO work_order_line_items (
        work_order_id, company_id, quote_line_item_id, line_number, item_type,
        description, style_number, style_name, color, sizes, quantity,
        supplier_type, supplier_name, garment_images, notes
      ) VALUES (
        v_work_order_id, NEW.company_id, v_line_item.id, v_line_item.line_number,
        v_mapped_item_type, v_line_item.description, v_line_item.item_number,
        v_line_item.brand, v_line_item.color, v_line_item.regular_sizes,
        v_line_item.qty, NULL, v_line_item.supplier_name,
        v_line_item.garment_images_data, v_line_item.notes
      );
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'work_order_created', 'System',
      jsonb_build_object('work_order_id', v_work_order_id, 'work_order_number', v_work_order_number,
      'line_items_count', (SELECT COUNT(*) FROM work_order_line_items WHERE work_order_id = v_work_order_id)));

    INSERT INTO printavo_invoices (
      id, invoice_number, company_id, customer_email, customer_name,
      customer_company, customer_phone, subtotal, tax, total,
      amount_paid, amount_outstanding, status, status_stage,
      invoice_date, due_date, customer_id, raw_data
    ) VALUES (
      v_invoice_id, v_invoice_id, NEW.company_id, NEW.customer_email,
      v_customer_name, v_customer_company, NEW.customer_phone,
      NEW.subtotal, NEW.tax_amount, NEW.total, 0, NEW.total,
      'Open', 'billing_queue', CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      NEW.customer_id,
      jsonb_build_object('source', 'quote_approval', 'quote_id', NEW.id,
      'quote_number', NEW.quote_number, 'work_order_id', v_work_order_id,
      'work_order_number', v_work_order_number)
    );

    INSERT INTO billing_queue (
      company_id, printavo_invoice_id, printavo_visual_id, printavo_status,
      customer_name, customer_email, customer_company, invoice_total,
      invoice_date, due_date, payment_status, metadata
    ) VALUES (
      NEW.company_id, v_invoice_id, NEW.quote_number, 'Open',
      v_customer_name, NEW.customer_email, v_customer_company,
      COALESCE(NEW.total, 0), CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      'unpaid',
      jsonb_build_object('source', 'quote_approval', 'quote_id', NEW.id,
      'quote_number', NEW.quote_number, 'work_order_id', v_work_order_id,
      'work_order_number', v_work_order_number)
    );

    FOR v_line_item IN
      SELECT id, line_number, line_type, description, item_number, brand,
        color, regular_sizes, COALESCE(total_quantity, quantity, 0) as qty,
        unit_price, total_price, notes
      FROM quote_line_items WHERE quote_id = NEW.id
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
        invoice_id, company_id, quote_line_item_id, line_number, item_type,
        description, style_number, style_name, color, sizes, quantity,
        unit_price, subtotal, tax_rate, tax_amount, total,
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
    NEW.status := 'converted';

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'invoice_created', 'System',
      jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_id,
      'line_items_count', (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = v_invoice_id)));

    FOR v_line_item IN
      SELECT qli.supplier_name, qli.item_number, qli.brand, qli.color,
        qli.regular_sizes, COALESCE(qli.total_quantity, qli.quantity, 0) as qty, qli.unit_price
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id AND qli.item_number IS NOT NULL AND COALESCE(qli.line_type, 'item') != 'fee'
    LOOP
      INSERT INTO garment_requirements_staging (
        company_id, quote_id, work_order_id, supplier_type, supplier_name,
        style_number, style_name, color, sizes, total_quantity, unit_cost, total_cost, is_po_created
      ) VALUES (
        NEW.company_id, NEW.id, v_work_order_id, NULL, v_line_item.supplier_name,
        v_line_item.item_number, v_line_item.brand, v_line_item.color,
        v_line_item.regular_sizes, v_line_item.qty, v_line_item.unit_price,
        v_line_item.qty * COALESCE(v_line_item.unit_price, 0), false
      );
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'garment_requirements_staged', 'System',
      jsonb_build_object('requirements_count', (SELECT COUNT(*) FROM garment_requirements_staging WHERE quote_id = NEW.id)));

    FOR v_imprint IN
      SELECT qi.id as imprint_id, qi.type_of_work, qi.imprint_number, qi.mockups, qi.thread_ink_color
      FROM quote_imprints qi WHERE qi.quote_id = NEW.id
    LOOP
      v_department := CASE
        WHEN v_imprint.type_of_work IN ('Screen Print', 'DTG', 'Sublimation') THEN 'printing'
        WHEN v_imprint.type_of_work IN ('Embroidery', 'Patches') THEN 'embroidery'
        ELSE 'production'
      END;

      v_artwork_url := NULL;
      IF v_imprint.mockups IS NOT NULL AND jsonb_array_length(v_imprint.mockups) > 0 THEN
        v_artwork_url := v_imprint.mockups->0->>'url';
      END IF;

      INSERT INTO production_schedule_entries (
        company_id, work_order_id, quote_id, imprint_id, department,
        due_date, status, priority, type_of_work, imprint_number,
        color, artwork_url, estimated_minutes, notes
      ) VALUES (
        NEW.company_id, v_work_order_id, NEW.id, v_imprint.imprint_id, v_department,
        NEW.production_due_date, 'pending', 'medium', v_imprint.type_of_work,
        v_imprint.imprint_number, v_imprint.thread_ink_color, v_artwork_url,
        NULL, NULL
      );
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'schedule_entries_created', 'System',
      jsonb_build_object('entries_count', (SELECT COUNT(*) FROM production_schedule_entries WHERE quote_id = NEW.id)));

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
