/*
  # Migrate QTE- prefixes to WO- and INV- prefixes

  1. Changes
    - Updates all existing work orders with "QTE-" prefix to use "WO-" prefix
    - Updates all existing invoices with "QTE-" prefix to use "INV-" prefix
    - Updates the `process_quote_approval()` trigger to generate WO- and INV- prefixes for new records
    - Updates related tables that reference these numbers (billing_queue, activity logs, etc.)

  2. Important Notes
    - Existing records: 1 work order and 6 invoices have "QTE-" prefix and will be migrated
    - The quote number itself remains unchanged (still QTE-XXXX format)
    - Work orders will use WO-XXXX format
    - Invoices will use INV-XXXX format
    - All foreign key relationships are preserved
*/

-- Step 1: Update existing work orders from QTE- to WO-
UPDATE work_orders
SET work_order_number = REPLACE(work_order_number, 'QTE-', 'WO-')
WHERE work_order_number LIKE 'QTE-%';

-- Step 2: Temporarily disable foreign key constraint for invoice_line_items
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_invoice_id_fkey;

-- Step 3: Update invoice_line_items references
UPDATE invoice_line_items
SET invoice_id = REPLACE(invoice_id, 'QTE-', 'INV-')
WHERE invoice_id LIKE 'QTE-%';

-- Step 4: Update billing_queue references
UPDATE billing_queue
SET printavo_invoice_id = REPLACE(printavo_invoice_id, 'QTE-', 'INV-')
WHERE printavo_invoice_id LIKE 'QTE-%';

-- Step 5: Update existing invoices from QTE- to INV-
-- Update the invoice_number field
UPDATE printavo_invoices
SET invoice_number = REPLACE(invoice_number, 'QTE-', 'INV-')
WHERE invoice_number LIKE 'QTE-%';

-- Update the id field (primary key) for invoices
UPDATE printavo_invoices
SET id = REPLACE(id, 'QTE-', 'INV-')
WHERE id LIKE 'QTE-%';

-- Step 6: Re-enable foreign key constraint for invoice_line_items
ALTER TABLE invoice_line_items 
ADD CONSTRAINT invoice_line_items_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES printavo_invoices(id) ON DELETE CASCADE;

-- Step 7: Update activity logs that contain work order numbers in metadata
UPDATE quote_activity_log
SET meta = jsonb_set(
  meta,
  '{work_order_number}',
  to_jsonb(REPLACE(meta->>'work_order_number', 'QTE-', 'WO-'))
)
WHERE action = 'work_order_created'
  AND meta->>'work_order_number' LIKE 'QTE-%';

-- Step 8: Update activity logs that contain invoice numbers in metadata
UPDATE quote_activity_log
SET meta = jsonb_set(
  meta,
  '{invoice_number}',
  to_jsonb(REPLACE(meta->>'invoice_number', 'QTE-', 'INV-'))
)
WHERE action = 'invoice_created'
  AND meta->>'invoice_number' LIKE 'QTE-%';

-- Step 9: Update the process_quote_approval() trigger to use new prefixes
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
  v_mapped_item_type text;
  v_default_distributor_name text;
  v_default_distributor_type text;
  v_ss_enabled boolean;
  v_san_enabled boolean;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN

    NEW.is_locked := true;

    SELECT COALESCE(cs.ssactivewear_enabled, false), COALESCE(cs.sanmar_enabled, false)
    INTO v_ss_enabled, v_san_enabled
    FROM company_settings cs WHERE cs.id = NEW.company_id;

    IF v_ss_enabled AND NOT v_san_enabled THEN
      v_default_distributor_name := 'SSACTIVEWEAR';
      v_default_distributor_type := 'ssactivewear';
    ELSIF v_san_enabled AND NOT v_ss_enabled THEN
      v_default_distributor_name := 'SanMar';
      v_default_distributor_type := 'sanmar';
    ELSIF v_ss_enabled AND v_san_enabled THEN
      v_default_distributor_name := 'SSACTIVEWEAR';
      v_default_distributor_type := 'ssactivewear';
    ELSE
      v_default_distributor_name := 'General Supplier';
      v_default_distributor_type := 'other';
    END IF;

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

    -- Transform quote number QTE-XXXX to WO-XXXX for work orders
    v_work_order_number := REPLACE(NEW.quote_number, 'QTE-', 'WO-');
    -- Transform quote number QTE-XXXX to INV-XXXX for invoices
    v_invoice_id := REPLACE(NEW.quote_number, 'QTE-', 'INV-');

    INSERT INTO work_orders (
      work_order_number, company_id, quote_id, customer_id, customer_name,
      status, priority, production_due_date, customer_due_date, total_quantity, notes
    ) VALUES (
      v_work_order_number, NEW.company_id, NEW.id, NEW.customer_id,
      COALESCE(NEW.customer_name, 'Unknown Customer'),
      'Pending Scheduling', 'medium', NEW.production_due_date, NEW.customer_due_date, v_total_quantity, NEW.notes
    ) RETURNING id INTO v_work_order_id;

    FOR v_line_item IN
      SELECT id, line_number, line_type, description, item_number, brand,
        color, COALESCE(total_quantity, quantity, 0) as qty,
        supplier_name, garment_images_data, notes,
        jsonb_strip_nulls(jsonb_build_object(
          'XS', NULLIF(COALESCE(qty_xs, 0), 0),
          'S', NULLIF(COALESCE(qty_s, 0), 0),
          'M', NULLIF(COALESCE(qty_m, 0), 0),
          'L', NULLIF(COALESCE(qty_l, 0), 0),
          'XL', NULLIF(COALESCE(qty_xl, 0), 0),
          '2XL', NULLIF(COALESCE(qty_2xl, 0), 0),
          '3XL', NULLIF(COALESCE(qty_3xl, 0), 0),
          '4XL', NULLIF(COALESCE(qty_4xl, 0), 0),
          '5XL', NULLIF(COALESCE(qty_5xl, 0), 0),
          'YXS', NULLIF(COALESCE(qty_yxs, 0), 0),
          'YS', NULLIF(COALESCE(qty_ys, 0), 0),
          'YM', NULLIF(COALESCE(qty_ym, 0), 0),
          'YL', NULLIF(COALESCE(qty_yl, 0), 0),
          'YXL', NULLIF(COALESCE(qty_yxl, 0), 0)
        )) as computed_sizes
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
        v_line_item.brand, v_line_item.color, v_line_item.computed_sizes,
        v_line_item.qty, NULL, COALESCE(NULLIF(v_line_item.supplier_name, ''), v_default_distributor_name),
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
      NEW.customer_name, NEW.customer_company, NEW.customer_phone,
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
      NEW.customer_name, NEW.customer_email, NEW.customer_company,
      COALESCE(NEW.total, 0), CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'),
      'unpaid',
      jsonb_build_object('source', 'quote_approval', 'quote_id', NEW.id,
        'quote_number', NEW.quote_number, 'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number)
    );

    FOR v_line_item IN
      SELECT id, line_number, line_type, description, item_number, brand,
        color, COALESCE(total_quantity, quantity, 0) as qty,
        unit_price, total_price, notes,
        jsonb_strip_nulls(jsonb_build_object(
          'XS', NULLIF(COALESCE(qty_xs, 0), 0),
          'S', NULLIF(COALESCE(qty_s, 0), 0),
          'M', NULLIF(COALESCE(qty_m, 0), 0),
          'L', NULLIF(COALESCE(qty_l, 0), 0),
          'XL', NULLIF(COALESCE(qty_xl, 0), 0),
          '2XL', NULLIF(COALESCE(qty_2xl, 0), 0),
          '3XL', NULLIF(COALESCE(qty_3xl, 0), 0),
          '4XL', NULLIF(COALESCE(qty_4xl, 0), 0),
          '5XL', NULLIF(COALESCE(qty_5xl, 0), 0),
          'YXS', NULLIF(COALESCE(qty_yxs, 0), 0),
          'YS', NULLIF(COALESCE(qty_ys, 0), 0),
          'YM', NULLIF(COALESCE(qty_ym, 0), 0),
          'YL', NULLIF(COALESCE(qty_yl, 0), 0),
          'YXL', NULLIF(COALESCE(qty_yxl, 0), 0)
        )) as computed_sizes
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
        v_line_item.brand, v_line_item.color, v_line_item.computed_sizes,
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
        COALESCE(qli.total_quantity, qli.quantity, 0) as qty,
        qli.unit_price, qli.description,
        jsonb_strip_nulls(jsonb_build_object(
          'XS', NULLIF(COALESCE(qli.qty_xs, 0), 0),
          'S', NULLIF(COALESCE(qli.qty_s, 0), 0),
          'M', NULLIF(COALESCE(qli.qty_m, 0), 0),
          'L', NULLIF(COALESCE(qli.qty_l, 0), 0),
          'XL', NULLIF(COALESCE(qli.qty_xl, 0), 0),
          '2XL', NULLIF(COALESCE(qli.qty_2xl, 0), 0),
          '3XL', NULLIF(COALESCE(qli.qty_3xl, 0), 0),
          '4XL', NULLIF(COALESCE(qli.qty_4xl, 0), 0),
          '5XL', NULLIF(COALESCE(qli.qty_5xl, 0), 0),
          'YXS', NULLIF(COALESCE(qli.qty_yxs, 0), 0),
          'YS', NULLIF(COALESCE(qli.qty_ys, 0), 0),
          'YM', NULLIF(COALESCE(qli.qty_ym, 0), 0),
          'YL', NULLIF(COALESCE(qli.qty_yl, 0), 0),
          'YXL', NULLIF(COALESCE(qli.qty_yxl, 0), 0)
        )) as computed_sizes
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id AND qli.item_number IS NOT NULL AND COALESCE(qli.line_type, 'item') != 'fee'
    LOOP
      INSERT INTO garment_requirements_staging (
        company_id, quote_id, work_order_id, supplier_type, supplier_name,
        style_number, style_name, color, sizes, total_quantity, unit_cost, total_cost, is_po_created
      ) VALUES (
        NEW.company_id, NEW.id, v_work_order_id,
        CASE WHEN COALESCE(NULLIF(v_line_item.supplier_name, ''), '') != '' THEN
          CASE
            WHEN LOWER(v_line_item.supplier_name) LIKE '%sanmar%' THEN 'sanmar'
            WHEN LOWER(v_line_item.supplier_name) LIKE '%ssactivewear%' OR LOWER(v_line_item.supplier_name) LIKE '%s&s%' THEN 'ssactivewear'
            ELSE 'other'
          END
        ELSE v_default_distributor_type
        END,
        COALESCE(NULLIF(v_line_item.supplier_name, ''), v_default_distributor_name),
        v_line_item.item_number, COALESCE(v_line_item.brand, SPLIT_PART(v_line_item.description, ' - ', 1)),
        v_line_item.color, v_line_item.computed_sizes, v_line_item.qty, v_line_item.unit_price,
        v_line_item.qty * COALESCE(v_line_item.unit_price, 0), false
      );
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'garment_requirements_staged', 'System',
      jsonb_build_object('requirements_count', (SELECT COUNT(*) FROM garment_requirements_staging WHERE quote_id = NEW.id AND is_po_created = false)));

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