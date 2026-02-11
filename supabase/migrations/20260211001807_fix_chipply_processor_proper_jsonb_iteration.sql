/*
  # Fix Chipply Processor - Proper JSONB Iteration

  1. Changes
    - Use proper JSONB array iteration by extracting elements into variables correctly
    - Access the value from the SELECT result set properly
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
  v_notes text;
  v_process_elem record;
  v_product_elem record;
  v_color_elem record;
  v_component_elem record;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_imprint_number integer := 1;
  v_size_data jsonb;
  v_account_summary jsonb;
  v_work_order_data jsonb;
  v_total_qty integer;
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

  -- Handle array wrapper if present
  IF jsonb_typeof(v_payload) = 'array' THEN
    v_payload := v_payload->0;
  END IF;

  v_account_summary := v_payload->'accountSummary';
  v_work_order_data := v_payload->'workOrderData';

  -- Extract customer data
  v_customer_name := v_account_summary->>'customerName';
  v_due_date := (v_account_summary->>'dueDate')::date;
  v_notes := 'Chipply Sale Order: ' || COALESCE(v_account_summary->>'saleOrder', 'N/A') ||
             E'\nStore: ' || COALESCE(v_account_summary->>'parentStoreName', 'N/A') ||
             E'\nBatch: ' || COALESCE(v_account_summary->>'batchId', 'N/A');

  -- Generate quote number
  SELECT 
    COALESCE(quote_prefix, 'QTE') || '-' || 
    LPAD((COALESCE(quote_start_number, 1))::text, 4, '0'),
    COALESCE(quote_start_number, 1)
  INTO v_quote_number, v_next_number
  FROM company_settings
  WHERE id = v_company_id;

  IF v_quote_number IS NULL THEN
    v_quote_number := 'QTE-' || LPAD('1', 4, '0');
    v_next_number := 1;
  END IF;

  -- Create the Quote
  INSERT INTO quotes (
    company_id,
    quote_number,
    customer_name,
    valid_until,
    notes,
    status,
    subtotal,
    total,
    chipply_import_log_id,
    created_at
  ) VALUES (
    v_company_id,
    v_quote_number,
    v_customer_name,
    v_due_date,
    v_notes,
    'draft',
    0,
    0,
    log_id,
    now()
  )
  RETURNING id INTO v_quote_id;

  -- Update company's next quote number
  UPDATE company_settings
  SET quote_start_number = v_next_number + 1
  WHERE id = v_company_id;

  -- Process each process in workOrderData.processes
  FOR v_process_elem IN 
    SELECT value AS process_data FROM jsonb_array_elements(v_work_order_data->'processes')
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
      v_process_elem.process_data->>'processName',
      v_process_elem.process_data->>'processDescription',
      now()
    )
    RETURNING id INTO v_imprint_id;

    v_imprint_number := v_imprint_number + 1;

    -- Process each product under this process
    FOR v_product_elem IN 
      SELECT value AS product_data FROM jsonb_array_elements(v_process_elem.process_data->'products')
    LOOP
      -- Process each color variant (productColors array)
      FOR v_color_elem IN 
        SELECT value AS color_data FROM jsonb_array_elements(v_product_elem.product_data->'productColors')
      LOOP
        -- Calculate total quantity
        SELECT COALESCE(SUM((size_elem->>'qty')::integer), 0)
        INTO v_total_qty
        FROM jsonb_array_elements(v_color_elem.color_data->'sizes') AS size_elem;
        
        -- Build size data from sizes array
        v_size_data := jsonb_build_object(
          'sizes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'size', size_elem->>'size',
                'quantity', (size_elem->>'qty')::integer
              )
            )
            FROM jsonb_array_elements(v_color_elem.color_data->'sizes') AS size_elem
          )
        );

        -- Create Line Item for this color variant
        INSERT INTO quote_line_items (
          quote_id,
          company_id,
          description,
          quantity,
          unit_price,
          total_price,
          notes,
          created_at
        ) VALUES (
          v_quote_id,
          v_company_id,
          v_product_elem.product_data->>'productName' || ' - ' || 
          v_product_elem.product_data->>'styleName' || ' - ' || 
          v_color_elem.color_data->>'colorName',
          v_total_qty,
          (v_color_elem.color_data->>'productPrice')::numeric,
          (v_color_elem.color_data->>'productPrice')::numeric * v_total_qty,
          'Vendor: ' || COALESCE(v_product_elem.product_data->>'vendorName', 'N/A') ||
          E'\nCost: $' || COALESCE(v_color_elem.color_data->>'productCost', '0') ||
          E'\nSizes: ' || v_size_data::text,
          now()
        )
        RETURNING id INTO v_line_item_id;
      END LOOP;
    END LOOP;

    -- Process components at the process level
    FOR v_component_elem IN 
      SELECT value AS component_data FROM jsonb_array_elements(v_process_elem.process_data->'components')
    LOOP
      INSERT INTO quote_line_items (
        quote_id,
        company_id,
        description,
        quantity,
        unit_price,
        total_price,
        decoration_method,
        decoration_location,
        notes,
        created_at
      ) VALUES (
        v_quote_id,
        v_company_id,
        'Decoration: ' || COALESCE(v_component_elem.component_data->>'artworkName', 'Unknown'),
        COALESCE((v_component_elem.component_data->>'qty')::integer, 0),
        COALESCE((v_component_elem.component_data->>'processPrice')::numeric, 0),
        COALESCE((v_component_elem.component_data->>'processPrice')::numeric, 0) * 
        COALESCE((v_component_elem.component_data->>'qty')::integer, 0),
        v_component_elem.component_data->>'typeCode',
        v_component_elem.component_data->>'artworkLocationName',
        'Location: ' || COALESCE(v_component_elem.component_data->>'artworkLocationName', '') ||
        E'\nNotes: ' || COALESCE(v_component_elem.component_data->>'notes', ''),
        now()
      );
    END LOOP;
  END LOOP;

  -- Calculate totals
  UPDATE quotes
  SET 
    subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM quote_line_items WHERE quote_id = v_quote_id),
    total = (SELECT COALESCE(SUM(total_price), 0) FROM quote_line_items WHERE quote_id = v_quote_id)
  WHERE id = v_quote_id;

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
END;
$$ LANGUAGE plpgsql;
