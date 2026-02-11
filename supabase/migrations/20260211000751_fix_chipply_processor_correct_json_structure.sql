/*
  # Fix Chipply Processor to Match Real JSON Structure

  1. Changes
    - Rewrite process_chipply_import() to correctly parse actual Chipply payload
    - Products have productColors array (not colors)
    - Images are image1Url, image2Url, image3Url
    - SKU is at the size level
    - Components are at process level, not product level
    - Extract totals from accountSummary.totals

  2. Security
    - No RLS changes
*/

CREATE OR REPLACE FUNCTION process_chipply_import(log_id uuid)
RETURNS void AS $$
DECLARE
  v_log_record chipply_import_logs%ROWTYPE;
  v_company_id uuid;
  v_payload jsonb;
  v_quote_id uuid;
  v_quote_number text;
  v_next_number integer;
  v_customer_name text;
  v_due_date date;
  v_nickname text;
  v_production_notes text;
  v_sale_order text;
  v_process jsonb;
  v_product jsonb;
  v_product_color jsonb;
  v_size jsonb;
  v_component jsonb;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_imprint_number integer := 1;
  v_size_data jsonb;
  v_total_qty integer;
  v_subtotal numeric := 0;
  v_total numeric := 0;
BEGIN
  -- Fetch the log record
  SELECT * INTO v_log_record
  FROM chipply_import_logs
  WHERE id = log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import log not found: %', log_id;
  END IF;

  v_company_id := v_log_record.company_id;
  v_payload := v_log_record.raw_json;

  -- Extract customer data from accountSummary
  v_customer_name := v_payload->'accountSummary'->>'customerName';
  v_due_date := (v_payload->'accountSummary'->>'dueDate')::date;
  v_sale_order := v_payload->'accountSummary'->>'saleOrder';
  
  -- Build nickname from parent store name and batch ID
  v_nickname := COALESCE(v_payload->'accountSummary'->>'parentStoreName', 'Chipply Order');
  IF v_payload->'accountSummary'->>'batchId' IS NOT NULL THEN
    v_nickname := v_nickname || ' – Batch ' || (v_payload->'accountSummary'->>'batchId');
  END IF;
  
  -- Extract totals if available
  IF v_payload->'accountSummary'->'totals'->'orderTotals'->>'subTotal' IS NOT NULL THEN
    v_subtotal := (v_payload->'accountSummary'->'totals'->'orderTotals'->>'subTotal')::numeric;
  END IF;
  IF v_payload->'accountSummary'->'totals'->'orderTotals'->>'order' IS NOT NULL THEN
    v_total := (v_payload->'accountSummary'->'totals'->'orderTotals'->>'order')::numeric;
  END IF;
  
  v_production_notes := 'Chipply Sale Order: ' || COALESCE(v_sale_order, 'N/A');
  IF v_payload->'accountSummary'->>'notes' IS NOT NULL AND v_payload->'accountSummary'->>'notes' != '' THEN
    v_production_notes := v_production_notes || E'\n' || v_payload->'accountSummary'->>'notes';
  END IF;

  -- Generate quote number using company's QTE numbering settings
  SELECT 
    COALESCE(quote_prefix, 'QTE') || '-' || 
    LPAD((COALESCE(next_number, 1))::text, 4, '0'),
    COALESCE(next_number, 1)
  INTO v_quote_number, v_next_number
  FROM company_settings
  WHERE id = v_company_id;

  IF v_quote_number IS NULL THEN
    v_quote_number := 'QTE-' || LPAD('1', 4, '0');
    v_next_number := 1;
  END IF;

  -- Create the Quote with Chipply references
  INSERT INTO quotes (
    company_id,
    quote_number,
    customer_name,
    customer_due_date,
    nickname,
    production_notes,
    status,
    subtotal,
    total,
    chipply_import_log_id,
    external_reference,
    created_at
  ) VALUES (
    v_company_id,
    v_quote_number,
    v_customer_name,
    v_due_date,
    v_nickname,
    v_production_notes,
    'draft',
    v_subtotal,
    v_total,
    log_id,
    v_sale_order,
    now()
  )
  RETURNING id INTO v_quote_id;

  -- Update company's next number
  UPDATE company_settings
  SET next_number = v_next_number + 1
  WHERE id = v_company_id;

  -- Process each process in workOrderData.processes
  FOR v_process IN 
    SELECT * FROM jsonb_array_elements(v_payload->'workOrderData'->'processes')
  LOOP
    -- Create Imprint for this process
    INSERT INTO quote_imprints (
      quote_id,
      company_id,
      imprint_number,
      type_of_work,
      details,
      created_at
    ) VALUES (
      v_quote_id,
      v_company_id,
      v_imprint_number::text,
      COALESCE(v_process->>'processName', 'Process ' || v_imprint_number),
      v_process->>'processDescription',
      now()
    )
    RETURNING id INTO v_imprint_id;

    v_imprint_number := v_imprint_number + 1;

    -- Process each product under this process
    FOR v_product IN 
      SELECT * FROM jsonb_array_elements(v_process->'products')
    LOOP
      -- Process each color variant (productColors array)
      FOR v_product_color IN 
        SELECT * FROM jsonb_array_elements(v_product->'productColors')
      LOOP
        -- Calculate total quantity for this color
        v_total_qty := COALESCE((v_product_color->>'totalQty')::integer, 0);
        
        -- Build size data from sizes array
        v_size_data := (
          SELECT jsonb_agg(
            jsonb_build_object(
              'size', s->>'size',
              'quantity', COALESCE((s->>'qty')::integer, 0),
              'sku', s->>'sku',
              'upc', s->>'upc'
            )
          )
          FROM jsonb_array_elements(v_product_color->'sizes') s
          WHERE COALESCE((s->>'qty')::integer, 0) > 0
        );

        -- Create Line Item for this color variant
        INSERT INTO quote_line_items (
          quote_id,
          company_id,
          line_type,
          description,
          brand,
          color,
          supplier_name,
          wholesale_price,
          unit_price,
          quantity,
          total_quantity,
          regular_sizes,
          supplier_partid,
          sku,
          garment_front_image_url,
          garment_side_image_url,
          garment_back_image_url,
          imprint_number,
          created_at
        ) VALUES (
          v_quote_id,
          v_company_id,
          'garment',
          v_product->>'productName',
          v_product->>'styleName',
          v_product_color->>'colorName',
          v_product->>'vendorName',
          COALESCE((v_product_color->>'productCost')::numeric, (v_product->>'productCost')::numeric, 0),
          COALESCE((v_product_color->>'productPrice')::numeric, (v_product->>'productPrice')::numeric, 0),
          v_total_qty,
          v_total_qty,
          COALESCE(v_size_data, '{}'::jsonb),
          (v_product_color->>'baseProductId')::text,
          (
            SELECT s->>'sku'
            FROM jsonb_array_elements(v_product_color->'sizes') s
            WHERE s->>'sku' IS NOT NULL
            LIMIT 1
          ),
          v_product_color->>'image1Url',
          v_product_color->>'image2Url',
          v_product_color->>'image3Url',
          v_imprint_number - 1,
          now()
        )
        RETURNING id INTO v_line_item_id;

      END LOOP;
    END LOOP;

    -- Process components (artwork/decoration) for this process
    FOR v_component IN 
      SELECT * FROM jsonb_array_elements(v_process->'components')
    LOOP
      -- Add component as a decoration line item or notes
      INSERT INTO quote_line_items (
        quote_id,
        company_id,
        line_type,
        description,
        decoration_method,
        decoration_location,
        unit_price,
        wholesale_price,
        quantity,
        notes,
        imprint_number,
        created_at
      ) VALUES (
        v_quote_id,
        v_company_id,
        'decoration',
        COALESCE(v_component->>'artworkName', 'Decoration'),
        v_component->>'typeCode',
        v_component->>'artworkLocationName',
        COALESCE((v_component->>'processPrice')::numeric, 0),
        COALESCE((v_component->>'processCost')::numeric, 0),
        COALESCE((v_component->>'qty')::integer, 1),
        v_component->>'notes',
        v_imprint_number - 1,
        now()
      );
    END LOOP;

  END LOOP;

  -- Mark import as processed
  UPDATE chipply_import_logs
  SET 
    status = 'processed',
    error_message = NULL,
    updated_at = now()
  WHERE id = log_id;

EXCEPTION WHEN OTHERS THEN
  -- Mark import as failed and save error message
  UPDATE chipply_import_logs
  SET 
    status = 'failed',
    error_message = SQLERRM,
    updated_at = now()
  WHERE id = log_id;
  
  RAISE NOTICE 'Error processing Chipply import %: %', log_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;
