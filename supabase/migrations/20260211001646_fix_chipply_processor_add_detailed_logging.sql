/*
  # Fix Chipply Processor - Add Detailed Logging

  1. Changes
    - Add RAISE NOTICE statements to track progress
    - Better error handling to identify exact failure point
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
  v_process jsonb;
  v_product jsonb;
  v_color jsonb;
  v_size jsonb;
  v_component jsonb;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_imprint_number integer := 1;
  v_size_data jsonb;
  v_account_summary jsonb;
  v_work_order_data jsonb;
  v_total_qty integer;
BEGIN
  RAISE NOTICE 'Starting import processing for log_id: %', log_id;
  
  -- Fetch the log record
  SELECT * INTO v_log_record
  FROM chipply_import_logs
  WHERE id = log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import log not found: %', log_id;
  END IF;

  v_company_id := v_log_record.company_id;
  v_payload := v_log_record.raw_json;

  RAISE NOTICE 'Payload type: %', jsonb_typeof(v_payload);

  -- Handle array wrapper if present
  IF jsonb_typeof(v_payload) = 'array' THEN
    v_payload := v_payload->0;
    RAISE NOTICE 'Unwrapped array payload';
  END IF;

  v_account_summary := v_payload->'accountSummary';
  v_work_order_data := v_payload->'workOrderData';

  RAISE NOTICE 'Extracting customer data...';
  
  -- Extract customer data
  v_customer_name := v_account_summary->>'customerName';
  v_due_date := (v_account_summary->>'dueDate')::date;
  v_notes := 'Chipply Sale Order: ' || COALESCE(v_account_summary->>'saleOrder', 'N/A') ||
             E'\nStore: ' || COALESCE(v_account_summary->>'parentStoreName', 'N/A') ||
             E'\nBatch: ' || COALESCE(v_account_summary->>'batchId', 'N/A');

  RAISE NOTICE 'Customer: %, Due Date: %', v_customer_name, v_due_date;

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

  RAISE NOTICE 'Generated quote number: %', v_quote_number;

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

  RAISE NOTICE 'Created quote with ID: %', v_quote_id;

  -- Update company's next quote number
  UPDATE company_settings
  SET quote_start_number = v_next_number + 1
  WHERE id = v_company_id;

  -- Process each process in workOrderData.processes
  FOR v_process IN 
    SELECT * FROM jsonb_array_elements(v_work_order_data->'processes')
  LOOP
    RAISE NOTICE 'Processing process: %', v_process->>'processName';
    
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
      v_process->>'processName',
      v_process->>'processDescription',
      now()
    )
    RETURNING id INTO v_imprint_id;

    RAISE NOTICE 'Created imprint with ID: %', v_imprint_id;
    v_imprint_number := v_imprint_number + 1;

    -- Process each product under this process
    FOR v_product IN 
      SELECT * FROM jsonb_array_elements(v_process->'products')
    LOOP
      RAISE NOTICE 'Processing product: %', v_product->>'productName';
      
      -- Process each color variant (productColors array)
      FOR v_color IN 
        SELECT * FROM jsonb_array_elements(v_product->'productColors')
      LOOP
        RAISE NOTICE 'Processing color: %', v_color->>'colorName';
        
        -- Calculate total quantity
        SELECT COALESCE(SUM((s->>'qty')::integer), 0)
        INTO v_total_qty
        FROM jsonb_array_elements(v_color->'sizes') s;
        
        RAISE NOTICE 'Total quantity: %', v_total_qty;
        
        -- Build size data from sizes array
        v_size_data := jsonb_build_object(
          'sizes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'size', s->>'size',
                'quantity', (s->>'qty')::integer
              )
            )
            FROM jsonb_array_elements(v_color->'sizes') s
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
          v_product->>'productName' || ' - ' || v_product->>'styleName' || ' - ' || v_color->>'colorName',
          v_total_qty,
          (v_color->>'productPrice')::numeric,
          (v_color->>'productPrice')::numeric * v_total_qty,
          'Vendor: ' || COALESCE(v_product->>'vendorName', 'N/A') ||
          E'\nCost: $' || COALESCE(v_color->>'productCost', '0') ||
          E'\nSizes: ' || v_size_data::text,
          now()
        )
        RETURNING id INTO v_line_item_id;
        
        RAISE NOTICE 'Created line item with ID: %', v_line_item_id;
      END LOOP;
    END LOOP;

    -- Process components at the process level
    FOR v_component IN 
      SELECT * FROM jsonb_array_elements(v_process->'components')
    LOOP
      RAISE NOTICE 'Processing component: %', v_component->>'artworkName';
      
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
        'Decoration: ' || COALESCE(v_component->>'artworkName', 'Unknown'),
        COALESCE((v_component->>'qty')::integer, 0),
        COALESCE((v_component->>'processPrice')::numeric, 0),
        COALESCE((v_component->>'processPrice')::numeric, 0) * COALESCE((v_component->>'qty')::integer, 0),
        v_component->>'typeCode',
        v_component->>'artworkLocationName',
        'Location: ' || COALESCE(v_component->>'artworkLocationName', '') ||
        E'\nNotes: ' || COALESCE(v_component->>'notes', ''),
        now()
      );
      
      RAISE NOTICE 'Created decoration line item';
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Calculating totals...';
  
  -- Calculate totals
  UPDATE quotes
  SET 
    subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM quote_line_items WHERE quote_id = v_quote_id),
    total = (SELECT COALESCE(SUM(total_price), 0) FROM quote_line_items WHERE quote_id = v_quote_id)
  WHERE id = v_quote_id;

  RAISE NOTICE 'Processing complete!';

  -- Mark import as processed
  UPDATE chipply_import_logs
  SET 
    status = 'processed',
    error_message = NULL,
    updated_at = now()
  WHERE id = log_id;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error occurred: %', SQLERRM;
  
  -- Mark import as failed and save error message
  UPDATE chipply_import_logs
  SET 
    status = 'failed',
    error_message = SQLERRM,
    updated_at = now()
  WHERE id = log_id;
  
  RAISE EXCEPTION 'Error processing Chipply import %: %', log_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;
