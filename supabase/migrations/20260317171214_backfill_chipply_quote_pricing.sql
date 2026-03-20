/*
  # Backfill Chipply Quote Pricing from Original Import Data

  1. Problem
    - Existing Chipply quotes have $0.00 for unit_price and total_price
    - Need to extract pricing from original chipply_import_logs.raw_json
    - Recalculate all line items and quote totals

  2. Process
    - Find all quotes where chipply_import_log_id IS NOT NULL
    - For each quote, retrieve original Chipply JSON payload
    - Extract productPrice from correct JSON path (product level)
    - Update all quote_line_items with correct unit_price and total_price
    - Recalculate quote subtotal and total

  3. Safety
    - Only updates quotes created from Chipply imports
    - Preserves all other quote data
    - Uses transaction to ensure atomic updates
*/

DO $$
DECLARE
  v_quote record;
  v_log record;
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
  v_process_name text;
  v_color_name text;
  v_product_name text;
  v_vendor_name text;
  v_style_name text;
  v_line_description text;
  i integer;
  j integer;
  k integer;
BEGIN
  RAISE NOTICE 'Starting backfill of Chipply quote pricing...';

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
      v_process_name := v_process->>'processName';
      v_products := v_process->'products';

      -- Loop through products
      FOR j IN 0..(jsonb_array_length(v_products) - 1) LOOP
        v_product := v_products->j;
        
        -- Extract product-level price (CRITICAL FIX)
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

          -- Find matching line item in quote
          FOR v_line_item IN
            SELECT id, quantity, 
                   (qty_yxs + qty_ys + qty_ym + qty_yl + qty_yxl + 
                    qty_xs + qty_s + qty_m + qty_l + qty_xl + 
                    qty_2xl + qty_3xl + qty_4xl + qty_5xl) as calculated_qty
            FROM quote_line_items
            WHERE quote_id = v_quote.id
              AND description = v_line_description
              AND line_type = 'garment'
          LOOP
            -- Calculate total quantity from size breakdown
            v_total_qty := COALESCE(v_line_item.calculated_qty, v_line_item.quantity);
            
            -- Calculate pricing
            v_unit_price := v_product_price;
            v_total_price := v_product_price * v_total_qty;

            -- Update the line item
            UPDATE quote_line_items
            SET 
              unit_price = v_unit_price,
              total_price = v_total_price,
              quantity = v_total_qty
            WHERE id = v_line_item.id;

            v_updated_count := v_updated_count + 1;
            
            RAISE NOTICE '  Updated line item: % (qty: %, unit: $%, total: $%)', 
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

    RAISE NOTICE 'Updated quote % totals - Subtotal: $%, Total: $%', 
      v_quote.quote_number, v_quote_subtotal, v_quote_total;

  END LOOP;

  RAISE NOTICE 'Backfill complete! Updated % line items across all Chipply quotes.', v_updated_count;

END;
$$;
