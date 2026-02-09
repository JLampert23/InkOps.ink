/*
  # Fix Invoice Status Stage in Approval

  1. Changes
    - Changes invoice status_stage from 'unpaid' to 'accounts_receivable' to match constraint
*/

CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_number text;
  v_work_order_id uuid;
  v_invoice_id text;
  v_line_item RECORD;
  v_next_wo_num int;
  v_next_inv_num int;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    NEW.is_locked := true;
    NEW.approved_at := COALESCE(NEW.approved_at, now());

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'quote_approved', COALESCE(NEW.approved_by_name, 'System'),
      jsonb_build_object('approved_at', NEW.approved_at));

    -- Generate work order number
    SELECT COALESCE(MAX(SUBSTRING(work_order_number FROM '\d+$'))::int, 0) + 1
    INTO v_next_wo_num
    FROM work_orders
    WHERE company_id = NEW.company_id
      AND work_order_number LIKE 'WO-' || to_char(now(), 'YYYYMMDD') || '-%';
    
    v_work_order_number := 'WO-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(v_next_wo_num::text, 5, '0');

    INSERT INTO work_orders (work_order_number, company_id, quote_id, customer_id, customer_name,
      status, priority, production_due_date, customer_due_date, notes)
    VALUES (v_work_order_number, NEW.company_id, NEW.id, NEW.customer_id,
      COALESCE(NEW.customer_name, 'Unknown'), 'draft', 'medium',
      NEW.production_due_date, NEW.customer_due_date, NEW.notes)
    RETURNING id INTO v_work_order_id;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'work_order_created', 'System',
      jsonb_build_object('work_order_id', v_work_order_id, 'work_order_number', v_work_order_number));

    -- Generate invoice number
    SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM '\d+$'))::int, 0) + 1
    INTO v_next_inv_num
    FROM printavo_invoices
    WHERE company_id = NEW.company_id
      AND invoice_number LIKE 'INV-' || to_char(now(), 'YYYYMMDD') || '-%';
    
    v_invoice_id := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(v_next_inv_num::text, 5, '0');

    INSERT INTO printavo_invoices (id, company_id, invoice_number, customer_email, customer_name,
      customer_company, customer_phone, subtotal, tax, total, amount_paid, amount_outstanding,
      status, status_stage, invoice_date, due_date, customer_id, raw_data)
    VALUES (v_invoice_id, NEW.company_id, v_invoice_id, NEW.customer_email, NEW.customer_name,
      NEW.customer_company, NEW.customer_phone, NEW.subtotal, NEW.tax_amount, NEW.total,
      0, NEW.total, 'Open', 'accounts_receivable', CURRENT_DATE,
      COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '30 days'), NEW.customer_id,
      jsonb_build_object('source', 'quote_approval', 'quote_id', NEW.id,
        'quote_number', NEW.quote_number, 'work_order_id', v_work_order_id,
        'work_order_number', v_work_order_number));

    FOR v_line_item IN
      SELECT qli.*, COALESCE(qli.total_quantity, qli.quantity, 0) as qty,
        COALESCE(qli.total_price, qli.line_total, qli.quantity * qli.unit_price, 0) as total_price
      FROM quote_line_items qli WHERE qli.quote_id = NEW.id
    LOOP
      INSERT INTO invoice_line_items (invoice_id, company_id, line_type, brand, item_number,
        description, color, total_quantity, unit_price, line_total,
        qty_xs, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl, qty_4xl, qty_5xl,
        qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl, notes)
      VALUES (v_invoice_id, NEW.company_id, v_line_item.line_type, v_line_item.brand,
        v_line_item.item_number, v_line_item.description, v_line_item.color, v_line_item.qty,
        v_line_item.unit_price, v_line_item.total_price,
        v_line_item.qty_xs, v_line_item.qty_s, v_line_item.qty_m, v_line_item.qty_l,
        v_line_item.qty_xl, v_line_item.qty_2xl, v_line_item.qty_3xl, v_line_item.qty_4xl,
        v_line_item.qty_5xl, v_line_item.qty_yxs, v_line_item.qty_ys, v_line_item.qty_ym,
        v_line_item.qty_yl, v_line_item.qty_yxl, v_line_item.notes);

      INSERT INTO work_order_line_items (work_order_id, company_id, line_type, brand, item_number,
        description, color, quantity, unit_price, line_total,
        qty_xs, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl, qty_4xl, qty_5xl,
        qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl, notes)
      VALUES (v_work_order_id, NEW.company_id, v_line_item.line_type, v_line_item.brand,
        v_line_item.item_number, v_line_item.description, v_line_item.color, v_line_item.qty,
        v_line_item.unit_price, v_line_item.total_price,
        v_line_item.qty_xs, v_line_item.qty_s, v_line_item.qty_m, v_line_item.qty_l,
        v_line_item.qty_xl, v_line_item.qty_2xl, v_line_item.qty_3xl, v_line_item.qty_4xl,
        v_line_item.qty_5xl, v_line_item.qty_yxs, v_line_item.qty_ys, v_line_item.qty_ym,
        v_line_item.qty_yl, v_line_item.qty_yxl, v_line_item.notes);
    END LOOP;

    NEW.converted_at := now();
    NEW.production_job_id := v_work_order_id;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'invoice_created', 'System',
      jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_id,
        'line_items_count', (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = v_invoice_id)));

    FOR v_line_item IN
      SELECT qli.supplier_name, qli.item_number, qli.brand, qli.color,
        COALESCE(qli.total_quantity, qli.quantity, 0) as qty,
        qli.unit_price, qli.description,
        jsonb_strip_nulls(jsonb_build_object(
          'XS', NULLIF(COALESCE(qli.qty_xs, 0), 0), 'S', NULLIF(COALESCE(qli.qty_s, 0), 0),
          'M', NULLIF(COALESCE(qli.qty_m, 0), 0), 'L', NULLIF(COALESCE(qli.qty_l, 0), 0),
          'XL', NULLIF(COALESCE(qli.qty_xl, 0), 0), '2XL', NULLIF(COALESCE(qli.qty_2xl, 0), 0),
          '3XL', NULLIF(COALESCE(qli.qty_3xl, 0), 0), '4XL', NULLIF(COALESCE(qli.qty_4xl, 0), 0),
          '5XL', NULLIF(COALESCE(qli.qty_5xl, 0), 0), 'YXS', NULLIF(COALESCE(qli.qty_yxs, 0), 0),
          'YS', NULLIF(COALESCE(qli.qty_ys, 0), 0), 'YM', NULLIF(COALESCE(qli.qty_ym, 0), 0),
          'YL', NULLIF(COALESCE(qli.qty_yl, 0), 0), 'YXL', NULLIF(COALESCE(qli.qty_yxl, 0), 0)
        )) as sizes_json
      FROM quote_line_items qli
      WHERE qli.quote_id = NEW.id AND qli.line_type = 'garment' AND qli.supplier_name IS NOT NULL
    LOOP
      INSERT INTO garment_requirements_staging (company_id, quote_id, work_order_id, supplier_name,
        style_number, style_name, color, sizes, total_quantity, unit_cost, total_cost, is_po_created)
      VALUES (NEW.company_id, NEW.id, v_work_order_id, v_line_item.supplier_name,
        v_line_item.item_number, v_line_item.description, v_line_item.color, v_line_item.sizes_json,
        v_line_item.qty, v_line_item.unit_price, v_line_item.qty * v_line_item.unit_price, false)
      ON CONFLICT DO NOTHING;
    END LOOP;

    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by_name, meta)
    VALUES (NEW.id, NEW.company_id, 'garment_requirements_staged', 'System',
      jsonb_build_object('count', (SELECT COUNT(*) FROM garment_requirements_staging WHERE quote_id = NEW.id)));

    INSERT INTO production_schedule_entries (company_id, quote_id, line_item_id, imprint_id,
      type_of_work, imprint_number, artwork_thumb_url, production_due_date, quantity,
      step_statuses, priority_order, customer_name, quote_number)
    SELECT NEW.company_id, NEW.id, qi.line_item_id, qi.id, qi.type_of_work, qi.imprint_number,
      qi.artwork_url, COALESCE(NEW.production_due_date, NEW.customer_due_date, CURRENT_DATE + INTERVAL '7 days'),
      COALESCE(qli.quantity, 0), '{}'::jsonb, 0, COALESCE(c.customer_name, NEW.customer_name), NEW.quote_number
    FROM quote_imprints qi
    LEFT JOIN quote_line_items qli ON qi.line_item_id = qli.id
    LEFT JOIN customers c ON NEW.customer_id = c.id
    WHERE qi.quote_id = NEW.id
    ON CONFLICT DO NOTHING;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
