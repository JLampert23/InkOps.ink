/*
  # Backfill Chipply Quote Pricing - Handle Legacy line_type

  1. Problem
    - Previous backfill only looked for line_type = 'garment'
    - Old Chipply imports used line_type = 'item'
    - Need to update both types

  2. Fix
    - Update backfill to match both 'garment' and 'item' line types
    - Also update line_type to 'garment' for consistency
*/

DO $$
DECLARE
  v_quote record;
  v_raw_json jsonb;
  v_work_order_data jsonb;
  v_processes jsonb;
  v_process jsonb;
  v_products jsonb;
  v_product jsonb;
  v_colors jsonb;
  v_color jsonb;
  v_product_price numeric;
  v_line_item record;
  v_total_qty integer;
  v_unit_price numeric;
  v_total_price numeric;
  v_quote_subtotal numeric;
  v_quote_total numeric;
  v_updated_count integer := 0;
  v_vendor_name text;
  v_product_name text;
  v_style_name text;
  v_color_name text;
  v_line_description text;
  i integer;
  j integer;
  k integer;
BEGIN
  RAISE NOTICE 'Starting backfill of Chipply quote pricing (including legacy imports)...';

  -- Loop through all Chipply quotes
  FOR v_quote IN 
    SELECT q.id, q.quote_number, q.chipply_import_log_id
    FROM quotes q
    WHERE q.chipply_import_log_id IS NOT NULL
    ORDER BY q.created_at DESC
  LOOP
    RAISE NOTICE 'Processing quote %...', v_quote.quote_number;

    -- Get the original Chipply import log
    SELECT raw_json->0 INTO v_raw_json
    FROM chipply_import_logs
    WHERE id = v_quote.chipply_import_log_id;

    IF v_raw_json IS NULL THEN
      RAISE NOTICE 'No raw JSON found for quote %, skipping', v_quote.quote_number;
      CONTINUE;
    END IF;

    -- Extract work order data
    v_work_order_data := v_raw_json->'workOrderData';
    v_processes := v_work_order_data->'processes';

    -- Loop through processes
    FOR i IN 0..(jsonb_array_length(v_processes) - 1) LOOP
      v_process := v_processes->i;
      v_products := v_process->'products';

      -- Loop through products
      FOR j IN 0..(jsonb_array_length(v_products) - 1) LOOP
        v_product := v_products->j;
        
        -- Extract product-level price
        v_product_price := COALESCE((v_product->>'productPrice')::numeric, 0);
        
        -- Extract product details for matching
        v_vendor_name := v_product->>'vendorName';
        v_product_name := v_product->>'productName';
        v_style_name := v_product->>'styleName';
        
        v_colors := v_product->'productColors';

        -- Loop through colors
        FOR k IN 0..(jsonb_array_length(v_colors) - 1) LOOP
          v_color := v_colors->k;
          v_color_name := v_color->>'colorName';
          
          -- Build expected line item description
          v_line_description := v_vendor_name || ' - ' || 
                               v_product_name || ' - ' || 
                               v_style_name || ' - ' || 
                               v_color_name;

          -- Find matching line item (handle both 'garment' and 'item' types)
          FOR v_line_item IN
            SELECT id, quantity, 
                   (COALESCE(qty_yxs, 0) + COALESCE(qty_ys, 0) + COALESCE(qty_ym, 0) + 
                    COALESCE(qty_yl, 0) + COALESCE(qty_yxl, 0) + COALESCE(qty_xs, 0) + 
                    COALESCE(qty_s, 0) + COALESCE(qty_m, 0) + COALESCE(qty_l, 0) + 
                    COALESCE(qty_xl, 0) + COALESCE(qty_2xl, 0) + COALESCE(qty_3xl, 0) + 
                    COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0)) as calculated_qty
            FROM quote_line_items
            WHERE quote_id = v_quote.id
              AND description = v_line_description
              AND line_type IN ('garment', 'item')
          LOOP
            -- Calculate total quantity from size breakdown
            v_total_qty := COALESCE(v_line_item.calculated_qty, v_line_item.quantity);
            
            -- If calculated_qty is 0, try to get from color-level totalQty
            IF v_total_qty = 0 THEN
              v_total_qty := COALESCE((v_color->>'totalQty')::integer, 1);
            END IF;
            
            -- Calculate pricing
            v_unit_price := v_product_price;
            v_total_price := v_product_price * v_total_qty;

            -- Update the line item (also normalize line_type to 'garment')
            UPDATE quote_line_items
            SET 
              line_type = 'garment',
              unit_price = v_unit_price,
              total_price = v_total_price,
              quantity = v_total_qty
            WHERE id = v_line_item.id;

            v_updated_count := v_updated_count + 1;
            
            RAISE NOTICE '  Updated: % (qty: %, unit: $%, total: $%)', 
              v_line_description, v_total_qty, v_unit_price, v_total_price;
          END LOOP;

        END LOOP; -- colors
      END LOOP; -- products
    END LOOP; -- processes

    -- Recalculate quote totals
    SELECT 
      COALESCE(SUM(total_price), 0),
      COALESCE(SUM(total_price), 0)
    INTO v_quote_subtotal, v_quote_total
    FROM quote_line_items
    WHERE quote_id = v_quote.id;

    -- Update quote totals
    UPDATE quotes
    SET 
      subtotal = v_quote_subtotal,
      total = v_quote_total
    WHERE id = v_quote.id;

    RAISE NOTICE 'Quote % totals - Subtotal: $%, Total: $%', 
      v_quote.quote_number, v_quote_subtotal, v_quote_total;

  END LOOP;

  RAISE NOTICE 'Backfill complete! Updated % line items.', v_updated_count;

END;
$$;
