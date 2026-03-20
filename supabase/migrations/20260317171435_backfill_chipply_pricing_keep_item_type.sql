/*
  # Backfill Chipply Quote Pricing - Keep 'item' Type

  1. Fix
    - Don't change line_type (constraint only allows 'item' or 'fee')
    - Just update pricing fields
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
  v_total_qty integer;
  v_unit_price numeric;
  v_total_price numeric;
  v_quote_subtotal numeric;
  v_quote_total numeric;
  v_updated_count integer := 0;
  v_line_items uuid[];
  v_line_item_idx integer := 1;
  v_line_item_id uuid;
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

    -- Get all line items for this quote in order
    SELECT array_agg(id ORDER BY created_at)
    INTO v_line_items
    FROM quote_line_items
    WHERE quote_id = v_quote.id
      AND line_type = 'item';

    IF v_line_items IS NULL OR array_length(v_line_items, 1) = 0 THEN
      RAISE NOTICE 'No line items found for quote %, skipping', v_quote.quote_number;
      CONTINUE;
    END IF;

    -- Reset line item index
    v_line_item_idx := 1;

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
        
        v_colors := v_product->'productColors';

        -- Loop through colors
        FOR k IN 0..(jsonb_array_length(v_colors) - 1) LOOP
          v_color := v_colors->k;
          
          -- Get total quantity from Chipply color data
          v_total_qty := COALESCE((v_color->>'totalQty')::integer, 1);
          
          -- Calculate pricing
          v_unit_price := v_product_price;
          v_total_price := v_product_price * v_total_qty;

          -- Get the corresponding line item by position
          IF v_line_item_idx <= array_length(v_line_items, 1) THEN
            v_line_item_id := v_line_items[v_line_item_idx];
            
            -- Update ONLY pricing fields (keep line_type as 'item')
            UPDATE quote_line_items
            SET 
              unit_price = v_unit_price,
              total_price = v_total_price,
              quantity = v_total_qty
            WHERE id = v_line_item_id;

            v_updated_count := v_updated_count + 1;
            v_line_item_idx := v_line_item_idx + 1;
            
            RAISE NOTICE '  Updated line item % (qty: %, unit: $%, total: $%)', 
              v_line_item_idx - 1, v_total_qty, v_unit_price, v_total_price;
          END IF;

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
