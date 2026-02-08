/*
  # Fix Existing PO Line Items with "Mixed" Sizes

  1. Problem
    - Existing auto-created PO line items all have size = 'Mixed' instead of individual size breakdowns
    - This makes the Receive Goods UI unable to show size-level receiving

  2. Fix
    - For each PO line item with size = 'Mixed', look up the original quote_line_item
    - Extract individual size quantities from qty_xs, qty_s, qty_m, etc.
    - Replace the single "Mixed" line item with individual per-size line items
    - Preserve the same po_id, company_id, style_number, color, unit_cost, etc.

  3. Important Notes
    - Only affects PO line items where size = 'Mixed' and quantity_received = 0
    - Does not touch POs where receiving has already occurred
    - Renumbers line items sequentially after expansion
*/

DO $$
DECLARE
  v_po RECORD;
  v_mixed_item RECORD;
  v_quote_line RECORD;
  v_size_label text;
  v_size_qty int;
  v_new_line_number int;
  v_sizes_found boolean;
BEGIN
  FOR v_po IN
    SELECT DISTINCT poli.po_id, poli.company_id
    FROM purchase_order_line_items poli
    WHERE poli.size = 'Mixed'
      AND poli.quantity_received = 0
  LOOP
    FOR v_mixed_item IN
      SELECT poli.*
      FROM purchase_order_line_items poli
      WHERE poli.po_id = v_po.po_id
        AND poli.size = 'Mixed'
        AND poli.quantity_received = 0
    LOOP
      SELECT qli.qty_xs, qli.qty_s, qli.qty_m, qli.qty_l, qli.qty_xl,
             qli.qty_2xl, qli.qty_3xl, qli.qty_4xl, qli.qty_5xl,
             qli.qty_yxs, qli.qty_ys, qli.qty_ym, qli.qty_yl, qli.qty_yxl
      INTO v_quote_line
      FROM quote_line_items qli
      WHERE qli.item_number = v_mixed_item.style_number
        AND qli.color = v_mixed_item.color
        AND qli.company_id = v_mixed_item.company_id
      LIMIT 1;

      IF v_quote_line IS NULL THEN
        CONTINUE;
      END IF;

      v_sizes_found := false;

      FOR v_size_label, v_size_qty IN
        SELECT * FROM (VALUES
          ('XS', COALESCE(v_quote_line.qty_xs, 0)),
          ('S', COALESCE(v_quote_line.qty_s, 0)),
          ('M', COALESCE(v_quote_line.qty_m, 0)),
          ('L', COALESCE(v_quote_line.qty_l, 0)),
          ('XL', COALESCE(v_quote_line.qty_xl, 0)),
          ('2XL', COALESCE(v_quote_line.qty_2xl, 0)),
          ('3XL', COALESCE(v_quote_line.qty_3xl, 0)),
          ('4XL', COALESCE(v_quote_line.qty_4xl, 0)),
          ('5XL', COALESCE(v_quote_line.qty_5xl, 0)),
          ('YXS', COALESCE(v_quote_line.qty_yxs, 0)),
          ('YS', COALESCE(v_quote_line.qty_ys, 0)),
          ('YM', COALESCE(v_quote_line.qty_ym, 0)),
          ('YL', COALESCE(v_quote_line.qty_yl, 0)),
          ('YXL', COALESCE(v_quote_line.qty_yxl, 0))
        ) AS t(size_label, size_qty)
        WHERE size_qty > 0
      LOOP
        IF NOT v_sizes_found THEN
          v_sizes_found := true;
          UPDATE purchase_order_line_items
          SET size = v_size_label,
              quantity_ordered = v_size_qty,
              extended_cost = v_mixed_item.unit_cost * v_size_qty
          WHERE id = v_mixed_item.id;
        ELSE
          INSERT INTO purchase_order_line_items (
            company_id, po_id, line_number, sku, style_number, product_name,
            color, size, quantity_ordered, quantity_received, unit_cost, extended_cost,
            vendor_product_id, notes
          ) VALUES (
            v_mixed_item.company_id, v_mixed_item.po_id, 999, v_mixed_item.sku,
            v_mixed_item.style_number, v_mixed_item.product_name,
            v_mixed_item.color, v_size_label, v_size_qty, 0,
            v_mixed_item.unit_cost, v_mixed_item.unit_cost * v_size_qty,
            v_mixed_item.vendor_product_id, v_mixed_item.notes
          );
        END IF;
      END LOOP;
    END LOOP;

    v_new_line_number := 0;
    FOR v_mixed_item IN
      SELECT id FROM purchase_order_line_items
      WHERE po_id = v_po.po_id
      ORDER BY style_number, color,
        CASE size
          WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
          WHEN 'XL' THEN 5 WHEN '2XL' THEN 6 WHEN '3XL' THEN 7 WHEN '4XL' THEN 8
          WHEN '5XL' THEN 9 WHEN 'YXS' THEN 10 WHEN 'YS' THEN 11 WHEN 'YM' THEN 12
          WHEN 'YL' THEN 13 WHEN 'YXL' THEN 14 ELSE 99
        END
    LOOP
      v_new_line_number := v_new_line_number + 1;
      UPDATE purchase_order_line_items SET line_number = v_new_line_number WHERE id = v_mixed_item.id;
    END LOOP;

    UPDATE purchase_orders
    SET subtotal = (SELECT COALESCE(SUM(extended_cost), 0) FROM purchase_order_line_items WHERE po_id = v_po.po_id),
        total_cost = (SELECT COALESCE(SUM(extended_cost), 0) FROM purchase_order_line_items WHERE po_id = v_po.po_id)
    WHERE id = v_po.po_id;
  END LOOP;
END $$;