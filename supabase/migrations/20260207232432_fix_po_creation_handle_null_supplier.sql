/*
  # Fix PO Creation When Supplier Name is NULL

  1. Changes
    - Updates `process_quote_approval()` to handle quote line items that have no supplier_name
    - Items without a supplier are grouped under a derived vendor name based on the product description
    - Known brands (Gildan, Hanes, Next Level, Bella+Canvas, CORE365, etc.) are mapped to SanMar
    - Remaining items without a known supplier go under a "General Supplier" vendor
    - Removes the filter that previously skipped items with NULL/empty supplier_name

  2. Bug Fix
    - Quote Q2626000 had all line items with supplier_name = NULL
    - The previous trigger skipped these items entirely, creating no POs
    - Now all garment line items with an item_number will get a PO regardless of supplier_name
*/

CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_supplier_group RECORD;
  v_resolved_supplier text;
  v_resolved_type text;
  v_vendor_id uuid;
  v_po_id uuid;
  v_po_number text;
  v_po_line_number int;
  v_size_key text;
  v_size_qty int;
  v_po_subtotal numeric;
  v_po_count int := 0;
  v_desc_lower text;
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

    SELECT COALESCE(SUM(COALESCE(total_quantity, quantity, 0)), 0) INTO v_total_quantity
    FROM quote_line_items WHERE quote_id = NEW.id AND COALESCE(line_type, 'item') != 'fee';

    v_quote_num := REGEXP_REPLACE(NEW.quote_number, '[^0-9]', '', 'g');
    v_work_order_number := 'WO-' || v_quote_num;
    v_invoice_id := 'INV-' || v_quote_num;

    -- Create Work Order
    INSERT INTO work_orders (
      work_order_number, company_id, quote_id, customer_id, customer_name,
      status, priority, production_due_date, customer_due_date, total_quantity, notes
    ) VALUES (
      v_work_order_number, NEW.company_id, NEW.id, NEW.customer_id,
      COALESCE(NEW.customer_name, 'Unknown Customer'),
      'Pending Scheduling', 'medium', NEW.production_due_date, NEW.customer_due_date, v_total_quantity, NEW.notes
    ) RETURNING id INTO v_work_order_id;

    -- Create Work Order Line Items
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

    -- Create Invoice
    INSERT INTO printavo_invoices (
      id, invoice_number, company_id, customer_email, customer_name,
      customer_company, customer_phone, subtotal, tax, total,
      amount_paid, amount_outstanding, status, status_stage,
      invoice_date, due_date, customer_id, raw_data
    ) VALUES (
      v_invoice_id, v_invoice_id, NEW.company_id, NEW.customer_email,
      NEW.customer_name, NEW.customer_company, NEW.customer_phone,
      NEW.subtotal, NEW.tax_amount, NEW.total, 0, NEW.total,
      'Open', 'billing_queue', CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      NEW.customer_id,
      jsonb_build_object('source', 'quote_approval', 'quote_id', NEW.id,
        'quote_number', NEW.quote_number, 'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number)
    );

    -- Add to Billing Queue
    INSERT INTO billing_queue (
      company_id, printavo_invoice_id, printavo_visual_id, printavo_status,
      customer_name, customer_email, customer_company, invoice_total,
      invoice_date, due_date, payment_status, metadata
    ) VALUES (
      NEW.company_id, v_invoice_id, NEW.quote_number, 'Open',
      NEW.customer_name, NEW.customer_email, NEW.customer_company,
      COALESCE(NEW.total, 0), CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      'unpaid',
      jsonb_build_object('source', 'quote_approval', 'quote_id', NEW.id,
        'quote_number', NEW.quote_number, 'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number)
    );

    -- Create Invoice Line Items
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

    -- Stage Garment Requirements (derive supplier from description when missing)
    FOR v_line_item IN
      SELECT qli.supplier_name, qli.item_number, qli.brand, qli.color,
        qli.regular_sizes, COALESCE(qli.total_quantity, qli.quantity, 0) as qty,
        qli.unit_price, qli.description
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id AND qli.item_number IS NOT NULL AND COALESCE(qli.line_type, 'item') != 'fee'
    LOOP
      v_desc_lower := LOWER(COALESCE(v_line_item.description, '') || ' ' || COALESCE(v_line_item.supplier_name, '') || ' ' || COALESCE(v_line_item.brand, ''));

      v_resolved_type := CASE
        WHEN COALESCE(v_line_item.supplier_name, '') != '' AND LOWER(v_line_item.supplier_name) LIKE '%sanmar%' THEN 'sanmar'
        WHEN COALESCE(v_line_item.supplier_name, '') != '' AND (LOWER(v_line_item.supplier_name) LIKE '%ssactivewear%' OR LOWER(v_line_item.supplier_name) LIKE '%s&s%') THEN 'ssactivewear'
        WHEN COALESCE(v_line_item.supplier_name, '') != '' THEN 'other'
        WHEN v_desc_lower LIKE '%gildan%' OR v_desc_lower LIKE '%hanes%' OR v_desc_lower LIKE '%comfort colors%'
          OR v_desc_lower LIKE '%next level%' OR v_desc_lower LIKE '%bella%canvas%' OR v_desc_lower LIKE '%core365%'
          OR v_desc_lower LIKE '%port %' OR v_desc_lower LIKE '%port &%' OR v_desc_lower LIKE '%sport-tek%'
          OR v_desc_lower LIKE '%district%' OR v_desc_lower LIKE '%cornerstone%' OR v_desc_lower LIKE '%red kap%'
          OR v_desc_lower LIKE '%allmade%' OR v_desc_lower LIKE '%mercer%mettle%' OR v_desc_lower LIKE '%nike%'
          OR v_desc_lower LIKE '%ogio%' OR v_desc_lower LIKE '%eddie bauer%' OR v_desc_lower LIKE '%carhartt%'
          OR v_desc_lower LIKE '%brooks brother%' OR v_desc_lower LIKE '%travismath%' OR v_desc_lower LIKE '%new era%' THEN 'sanmar'
        WHEN v_desc_lower LIKE '%tultex%' OR v_desc_lower LIKE '%anvil%' OR v_desc_lower LIKE '%jerzees%'
          OR v_desc_lower LIKE '%fruit of the loom%' OR v_desc_lower LIKE '%champion%'
          OR v_desc_lower LIKE '%alternative%' OR v_desc_lower LIKE '%augusta%' OR v_desc_lower LIKE '%badger%'
          OR v_desc_lower LIKE '%boxercraft%' THEN 'ssactivewear'
        ELSE 'other'
      END;

      v_resolved_supplier := CASE
        WHEN COALESCE(v_line_item.supplier_name, '') != '' THEN v_line_item.supplier_name
        WHEN v_resolved_type = 'sanmar' THEN 'SanMar'
        WHEN v_resolved_type = 'ssactivewear' THEN 'S&S Activewear'
        ELSE 'General Supplier'
      END;

      INSERT INTO garment_requirements_staging (
        company_id, quote_id, work_order_id, supplier_type, supplier_name,
        style_number, style_name, color, sizes, total_quantity, unit_cost, total_cost, is_po_created
      ) VALUES (
        NEW.company_id, NEW.id, v_work_order_id, v_resolved_type, v_resolved_supplier,
        v_line_item.item_number, COALESCE(v_line_item.brand, SPLIT_PART(v_line_item.description, ' - ', 1)),
        v_line_item.color, v_line_item.regular_sizes, v_line_item.qty, v_line_item.unit_price,
        v_line_item.qty * COALESCE(v_line_item.unit_price, 0), false
      );
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'garment_requirements_staged', 'System',
      jsonb_build_object('requirements_count', (SELECT COUNT(*) FROM garment_requirements_staging WHERE quote_id = NEW.id AND is_po_created = false)));

    -- Auto-Create Purchase Orders grouped by resolved supplier
    FOR v_supplier_group IN
      SELECT
        COALESCE(NULLIF(qli.supplier_name, ''),
          CASE
            WHEN LOWER(COALESCE(qli.description, '')) LIKE '%gildan%' OR LOWER(COALESCE(qli.description, '')) LIKE '%hanes%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%comfort colors%' OR LOWER(COALESCE(qli.description, '')) LIKE '%next level%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%bella%canvas%' OR LOWER(COALESCE(qli.description, '')) LIKE '%core365%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%port %' OR LOWER(COALESCE(qli.description, '')) LIKE '%port &%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%sport-tek%' OR LOWER(COALESCE(qli.description, '')) LIKE '%district%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%cornerstone%' OR LOWER(COALESCE(qli.description, '')) LIKE '%red kap%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%nike%' OR LOWER(COALESCE(qli.description, '')) LIKE '%ogio%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%eddie bauer%' OR LOWER(COALESCE(qli.description, '')) LIKE '%carhartt%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%new era%' THEN 'SanMar'
            WHEN LOWER(COALESCE(qli.description, '')) LIKE '%tultex%' OR LOWER(COALESCE(qli.description, '')) LIKE '%anvil%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%jerzees%' OR LOWER(COALESCE(qli.description, '')) LIKE '%champion%'
              OR LOWER(COALESCE(qli.description, '')) LIKE '%augusta%' OR LOWER(COALESCE(qli.description, '')) LIKE '%badger%' THEN 'S&S Activewear'
            ELSE 'General Supplier'
          END
        ) as resolved_name,
        CASE
          WHEN COALESCE(NULLIF(qli.supplier_name, ''), '') != '' AND LOWER(qli.supplier_name) LIKE '%sanmar%' THEN 'sanmar'
          WHEN COALESCE(NULLIF(qli.supplier_name, ''), '') != '' AND (LOWER(qli.supplier_name) LIKE '%ssactivewear%' OR LOWER(qli.supplier_name) LIKE '%s&s%') THEN 'ssactivewear'
          WHEN LOWER(COALESCE(qli.description, '')) LIKE '%gildan%' OR LOWER(COALESCE(qli.description, '')) LIKE '%hanes%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%comfort colors%' OR LOWER(COALESCE(qli.description, '')) LIKE '%next level%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%bella%canvas%' OR LOWER(COALESCE(qli.description, '')) LIKE '%core365%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%port %' OR LOWER(COALESCE(qli.description, '')) LIKE '%sport-tek%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%district%' OR LOWER(COALESCE(qli.description, '')) LIKE '%nike%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%ogio%' OR LOWER(COALESCE(qli.description, '')) LIKE '%eddie bauer%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%carhartt%' OR LOWER(COALESCE(qli.description, '')) LIKE '%new era%' THEN 'sanmar'
          WHEN LOWER(COALESCE(qli.description, '')) LIKE '%tultex%' OR LOWER(COALESCE(qli.description, '')) LIKE '%anvil%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%jerzees%' OR LOWER(COALESCE(qli.description, '')) LIKE '%champion%'
            OR LOWER(COALESCE(qli.description, '')) LIKE '%augusta%' OR LOWER(COALESCE(qli.description, '')) LIKE '%badger%' THEN 'ssactivewear'
          ELSE 'other'
        END as resolved_type,
        COUNT(*) as item_count
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id
        AND qli.item_number IS NOT NULL
        AND COALESCE(qli.line_type, 'item') != 'fee'
      GROUP BY resolved_name, resolved_type
    LOOP
      v_vendor_id := get_or_create_vendor(
        NEW.company_id,
        v_supplier_group.resolved_type,
        v_supplier_group.resolved_name
      );

      SELECT generate_po_number() INTO v_po_number;

      INSERT INTO purchase_orders (
        company_id, po_number, vendor_id, status,
        expected_delivery_date, internal_notes
      ) VALUES (
        NEW.company_id, v_po_number, v_vendor_id, 'draft',
        COALESCE(NEW.production_due_date, CURRENT_DATE + INTERVAL '7 days'),
        'Auto-created from approved quote ' || NEW.quote_number || ' (WO: ' || v_work_order_number || ')'
      ) RETURNING id INTO v_po_id;

      v_po_line_number := 0;
      v_po_subtotal := 0;

      FOR v_line_item IN
        SELECT item_number, brand, color, regular_sizes, description,
          COALESCE(total_quantity, quantity, 0) as qty, unit_price, notes,
          COALESCE(NULLIF(supplier_name, ''),
            CASE
              WHEN LOWER(COALESCE(description, '')) LIKE '%gildan%' OR LOWER(COALESCE(description, '')) LIKE '%hanes%'
                OR LOWER(COALESCE(description, '')) LIKE '%comfort colors%' OR LOWER(COALESCE(description, '')) LIKE '%next level%'
                OR LOWER(COALESCE(description, '')) LIKE '%bella%canvas%' OR LOWER(COALESCE(description, '')) LIKE '%core365%'
                OR LOWER(COALESCE(description, '')) LIKE '%port %' OR LOWER(COALESCE(description, '')) LIKE '%sport-tek%'
                OR LOWER(COALESCE(description, '')) LIKE '%district%' OR LOWER(COALESCE(description, '')) LIKE '%nike%'
                OR LOWER(COALESCE(description, '')) LIKE '%ogio%' OR LOWER(COALESCE(description, '')) LIKE '%eddie bauer%'
                OR LOWER(COALESCE(description, '')) LIKE '%carhartt%' OR LOWER(COALESCE(description, '')) LIKE '%new era%' THEN 'SanMar'
              WHEN LOWER(COALESCE(description, '')) LIKE '%tultex%' OR LOWER(COALESCE(description, '')) LIKE '%anvil%'
                OR LOWER(COALESCE(description, '')) LIKE '%jerzees%' OR LOWER(COALESCE(description, '')) LIKE '%champion%'
                OR LOWER(COALESCE(description, '')) LIKE '%augusta%' OR LOWER(COALESCE(description, '')) LIKE '%badger%' THEN 'S&S Activewear'
              ELSE 'General Supplier'
            END
          ) as computed_supplier
        FROM quote_line_items
        WHERE quote_id = NEW.id
          AND item_number IS NOT NULL
          AND COALESCE(line_type, 'item') != 'fee'
        ORDER BY COALESCE(sort_order, line_number)
      LOOP
        IF v_line_item.computed_supplier = v_supplier_group.resolved_name THEN
          IF v_line_item.regular_sizes IS NOT NULL AND jsonb_typeof(v_line_item.regular_sizes) = 'object'
             AND (SELECT COUNT(*) FROM jsonb_each_text(v_line_item.regular_sizes) WHERE value::text::integer > 0) > 0 THEN
            FOR v_size_key, v_size_qty IN
              SELECT key, value::text::integer
              FROM jsonb_each_text(v_line_item.regular_sizes)
              WHERE value::text::integer > 0
            LOOP
              v_po_line_number := v_po_line_number + 1;
              v_po_subtotal := v_po_subtotal + (COALESCE(v_line_item.unit_price, 0) * v_size_qty);

              INSERT INTO purchase_order_line_items (
                company_id, po_id, line_number, style_number, product_name,
                color, size, quantity_ordered, quantity_received, unit_cost, extended_cost, notes
              ) VALUES (
                NEW.company_id, v_po_id, v_po_line_number, v_line_item.item_number,
                COALESCE(v_line_item.brand, SPLIT_PART(v_line_item.description, ' - ', 1)),
                v_line_item.color, v_size_key,
                v_size_qty, 0, COALESCE(v_line_item.unit_price, 0),
                COALESCE(v_line_item.unit_price, 0) * v_size_qty, v_line_item.notes
              );
            END LOOP;
          ELSE
            v_po_line_number := v_po_line_number + 1;
            v_po_subtotal := v_po_subtotal + (COALESCE(v_line_item.unit_price, 0) * v_line_item.qty);

            INSERT INTO purchase_order_line_items (
              company_id, po_id, line_number, style_number, product_name,
              color, size, quantity_ordered, quantity_received, unit_cost, extended_cost, notes
            ) VALUES (
              NEW.company_id, v_po_id, v_po_line_number, v_line_item.item_number,
              COALESCE(v_line_item.brand, SPLIT_PART(v_line_item.description, ' - ', 1)),
              v_line_item.color, 'Mixed',
              v_line_item.qty, 0, COALESCE(v_line_item.unit_price, 0),
              COALESCE(v_line_item.unit_price, 0) * v_line_item.qty, v_line_item.notes
            );
          END IF;
        END IF;
      END LOOP;

      UPDATE purchase_orders SET subtotal = v_po_subtotal, total_cost = v_po_subtotal WHERE id = v_po_id;

      UPDATE garment_requirements_staging
      SET is_po_created = true, po_id = v_po_id, updated_at = now()
      WHERE quote_id = NEW.id AND is_po_created = false
        AND COALESCE(supplier_name, 'General Supplier') = v_supplier_group.resolved_name;

      v_po_count := v_po_count + 1;

      INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
      VALUES (NEW.id, NEW.company_id, 'purchase_order_created', 'System',
        jsonb_build_object('po_id', v_po_id, 'po_number', v_po_number,
          'vendor_name', v_supplier_group.resolved_name, 'vendor_type', v_supplier_group.resolved_type,
          'line_items_count', v_po_line_number, 'subtotal', v_po_subtotal));
    END LOOP;

    IF v_po_count > 0 THEN
      INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
      VALUES (NEW.id, NEW.company_id, 'auto_pos_created', 'System',
        jsonb_build_object('total_pos_created', v_po_count));
    END IF;

    -- Push Imprints to Production Scheduler
    FOR v_imprint IN
      SELECT qi.id as imprint_id, qi.type_of_work, qi.imprint_number, qi.mockups, qi.thread_ink_color
      FROM quote_imprints qi WHERE qi.quote_id = NEW.id
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
        IF v_artwork_url IS NULL THEN v_artwork_url := v_imprint.mockups->>0; END IF;
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
        v_total_quantity, '{}'::jsonb, 0, COALESCE(NEW.customer_name, 'Unknown'),
        NEW.quote_number, v_imprint.thread_ink_color, 0, v_department, NEW.notes
      ) ON CONFLICT DO NOTHING;
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'scheduler_entries_created', 'System',
      jsonb_build_object('schedule_entries_count', (SELECT COUNT(*) FROM production_schedule_entries WHERE quote_id = NEW.id)));

  END IF;

  RETURN NEW;
END;
$$;