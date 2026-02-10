/*
  # Fix Chipply Processor Column Names

  1. Changes
    - Update process_chipply_import() to use correct column names from company_settings:
      - Use `quote_prefix` instead of `quote_number_prefix`
      - Use `next_number` instead of `quote_number_next`
      - Use hardcoded padding of 4 instead of `quote_number_padding`
    - Increment `next_number` after creating quote

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
  v_color jsonb;
  v_size jsonb;
  v_component jsonb;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_imprint_number integer := 1;
  v_size_data jsonb;
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

  -- Extract customer data
  v_customer_name := v_payload->'accountSummary'->>'customerName';
  v_due_date := (v_payload->'accountSummary'->>'dueDate')::date;
  v_sale_order := v_payload->'accountSummary'->>'saleOrder';
  v_nickname := COALESCE(v_payload->'accountSummary'->>'parentStoreName', 'Chipply Order') || 
                ' – Batch ' || COALESCE(v_payload->'accountSummary'->>'batchId', 'N/A');
  v_production_notes := 'Chipply Sale Order Reference: ' || COALESCE(v_sale_order, 'N/A');

  -- Generate quote number using company's QTE numbering settings
  SELECT 
    COALESCE(quote_prefix, 'QTE') || '-' || 
    LPAD((COALESCE(next_number, 1))::text, 4, '0'),
    COALESCE(next_number, 1)
  INTO v_quote_number, v_next_number
  FROM company_settings
  WHERE company_id = v_company_id;

  IF v_quote_number IS NULL THEN
    v_quote_number := 'QTE-' || LPAD('1', 4, '0');
    v_next_number := 1;
  END IF;

  -- Create the Quote with Chipply references
  INSERT INTO quotes (
    company_id,
    quote_number,
    customer_name,
    due_date,
    nickname,
    production_notes,
    status,
    total_cost,
    total_price,
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
    0,
    0,
    log_id,
    v_sale_order,
    now()
  )
  RETURNING id INTO v_quote_id;

  -- Update company's next number
  UPDATE company_settings
  SET next_number = v_next_number + 1
  WHERE company_id = v_company_id;

  -- Process each process in workOrderData.processes
  FOR v_process IN 
    SELECT * FROM jsonb_array_elements(v_payload->'workOrderData'->'processes')
  LOOP
    -- Create Imprint for this process
    INSERT INTO quote_imprints (
      quote_id,
      imprint_number,
      imprint_type,
      imprint_description,
      due_date,
      created_at
    ) VALUES (
      v_quote_id,
      v_imprint_number,
      v_process->>'processName',
      v_process->>'processDescription',
      (v_process->>'dueDate')::date,
      now()
    )
    RETURNING id INTO v_imprint_id;

    v_imprint_number := v_imprint_number + 1;

    -- Process each product under this process
    FOR v_product IN 
      SELECT * FROM jsonb_array_elements(v_process->'products')
    LOOP
      -- Process each color variant
      FOR v_color IN 
        SELECT * FROM jsonb_array_elements(v_product->'colors')
      LOOP
        -- Build size data from sizes array
        v_size_data := jsonb_build_object(
          'sizes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'size', s->>'sizeId',
                'quantity', (s->>'qty')::integer
              )
            )
            FROM jsonb_array_elements(v_color->'sizes') s
          )
        );

        -- Create Line Item for this color variant
        INSERT INTO quote_line_items (
          quote_id,
          line_type,
          name,
          style,
          color,
          vendor,
          cost,
          price,
          quantity,
          sizes,
          supplier_part_id,
          supplier_vendor,
          garment_front_image_url,
          garment_side_image_url,
          garment_back_image_url,
          created_at
        ) VALUES (
          v_quote_id,
          'garment',
          v_product->>'productName',
          v_product->>'styleName',
          v_color->>'colorName',
          v_product->>'vendorName',
          (v_product->>'productCost')::numeric,
          (v_product->>'productPrice')::numeric,
          (
            SELECT COALESCE(SUM((s->>'qty')::integer), 0)
            FROM jsonb_array_elements(v_color->'sizes') s
          ),
          v_size_data,
          v_product->>'sku',
          v_product->>'vendorName',
          v_color->>'frontImageUrl',
          v_color->>'sideImageUrl',
          v_color->>'backImageUrl',
          now()
        )
        RETURNING id INTO v_line_item_id;

        -- Process components (imprint details) for this product
        FOR v_component IN 
          SELECT * FROM jsonb_array_elements(v_product->'components')
        LOOP
          -- Link component to the imprint
          -- Store component data in production_notes or metadata
          UPDATE quote_line_items
          SET production_notes = COALESCE(production_notes, '') || 
            E'\n' || 'Artwork: ' || COALESCE(v_component->>'artworkName', '') ||
            E'\n' || 'Location: ' || COALESCE(v_component->>'artworkLocation', '') ||
            E'\n' || 'Notes: ' || COALESCE(v_component->>'notes', '') ||
            E'\n' || 'Qty: ' || COALESCE(v_component->>'qty', '0') ||
            E'\n' || 'Process Cost: ' || COALESCE(v_component->>'processCost', '0') ||
            E'\n' || 'Process Price: ' || COALESCE(v_component->>'processPrice', '0')
          WHERE id = v_line_item_id;
        END LOOP;
      END LOOP;
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
