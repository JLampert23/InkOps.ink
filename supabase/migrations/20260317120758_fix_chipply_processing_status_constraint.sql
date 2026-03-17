/*
  # Fix Chipply Import Processing Status Constraint Error

  1. Problem
    - The process_chipply_import function tries to set status = 'processing'
    - The check constraint only allows: 'pending', 'processed', 'failed'
    - This causes: "new row violates check constraint chipply_import_logs_status_check"

  2. Solution
    - Remove the 'processing' status from the function
    - Rely on PostgreSQL's row-level locking (SELECT FOR UPDATE) to prevent concurrent processing
    - Simplify status flow: pending -> processed/failed only
    - The FOR UPDATE lock already prevents race conditions effectively

  3. Changes
    - Update process_chipply_import function to remove 'processing' status references
    - Keep all other safety features: idempotency, locking, deduplication
*/

-- Drop and recreate the function without 'processing' status
DROP FUNCTION IF EXISTS process_chipply_import(uuid);

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
  v_customer_email text;
  v_customer_phone text;
  v_customer_company text;
  v_customer_id uuid;
  v_due_date date;
  v_notes text;
  v_sale_order_id text;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_imprint_number integer := 1;
  v_size_data jsonb;
  v_account_summary jsonb;
  v_work_order_data jsonb;
  v_total_qty integer;
  v_process jsonb;
  v_product jsonb;
  v_color jsonb;
  v_component jsonb;
  v_processes jsonb;
  v_products jsonb;
  v_colors jsonb;
  v_components jsonb;
  v_first_component jsonb;
  v_artwork_variations jsonb;
  v_first_variation jsonb;
  v_artwork_url text;
  v_temp_text text;
  v_existing_quote_id uuid;
  i integer;
  j integer;
  k integer;
  m integer;
BEGIN
  -- Fetch the log record WITH row-level lock to prevent concurrent processing
  SELECT * INTO v_log_record
  FROM chipply_import_logs
  WHERE id = log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import log not found: %', log_id;
  END IF;

  -- IDEMPOTENCY CHECK: Skip if already processed
  IF v_log_record.status = 'processed' THEN
    RAISE NOTICE 'Import log % already processed, skipping', log_id;
    RETURN;
  END IF;

  v_company_id := v_log_record.company_id;
  v_payload := v_log_record.raw_json;

  -- Handle array wrapper if present
  IF jsonb_typeof(v_payload) = 'array' THEN
    v_payload := v_payload->0;
  END IF;

  -- Extract top-level objects
  v_account_summary := v_payload->'accountSummary';
  v_work_order_data := v_payload->'workOrderData';

  -- Extract customer data
  SELECT 
    v_account_summary->>'customerName',
    v_account_summary->>'email',
    v_account_summary->>'phone',
    v_account_summary->>'companyName',
    (v_account_summary->>'dueDate')::date,
    v_account_summary->>'saleOrder'
  INTO v_customer_name, v_customer_email, v_customer_phone, v_customer_company, v_due_date, v_sale_order_id;

  -- DEDUPLICATION: Check if this sale order was already imported
  IF v_sale_order_id IS NOT NULL THEN
    SELECT id INTO v_existing_quote_id
    FROM quotes
    WHERE company_id = v_company_id
    AND chipply_sale_order_id = v_sale_order_id
    LIMIT 1;

    IF v_existing_quote_id IS NOT NULL THEN
      -- Already imported, mark as processed and exit
      UPDATE chipply_import_logs
      SET 
        status = 'processed',
        error_message = 'Duplicate import - sale order ' || v_sale_order_id || ' already exists as quote ' || 
                       (SELECT quote_number FROM quotes WHERE id = v_existing_quote_id),
        updated_at = now()
      WHERE id = log_id;
      
      RAISE NOTICE 'Duplicate import detected for sale order %, skipping', v_sale_order_id;
      RETURN;
    END IF;
  END IF;

  -- Try to find or create customer
  IF v_customer_email IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE company_id = v_company_id
    AND email = v_customer_email
    LIMIT 1;

    IF v_customer_id IS NULL AND v_customer_name IS NOT NULL THEN
      INSERT INTO customers (
        company_id,
        name,
        email,
        phone,
        company_name,
        created_at
      ) VALUES (
        v_company_id,
        v_customer_name,
        v_customer_email,
        v_customer_phone,
        v_customer_company,
        now()
      )
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  -- Build notes
  v_notes := 'Chipply Sale Order: ' || COALESCE(v_sale_order_id, 'N/A') ||
             E'\nStore: ' || COALESCE(v_account_summary->>'parentStoreName', 'N/A') ||
             E'\nBatch: ' || COALESCE(v_account_summary->>'batchId', 'N/A');

  -- Generate quote number WITH row-level lock to prevent race conditions
  SELECT 
    COALESCE(quote_prefix, 'QTE') || '-' || 
    LPAD((COALESCE(quote_start_number, 1))::text, 4, '0'),
    COALESCE(quote_start_number, 1)
  INTO v_quote_number, v_next_number
  FROM company_settings
  WHERE id = v_company_id
  FOR UPDATE; -- CRITICAL: Lock the row to prevent concurrent quote number generation

  IF v_quote_number IS NULL THEN
    v_quote_number := 'QTE-' || LPAD('1', 4, '0');
    v_next_number := 1;
  END IF;

  -- Create the Quote
  INSERT INTO quotes (
    company_id,
    quote_number,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_company,
    valid_until,
    notes,
    status,
    subtotal,
    total,
    chipply_import_log_id,
    chipply_sale_order_id,
    created_at
  ) VALUES (
    v_company_id,
    v_quote_number,
    v_customer_id,
    COALESCE(v_customer_name, 'Chipply Customer'),
    v_customer_email,
    v_customer_phone,
    v_customer_company,
    v_due_date,
    v_notes,
    'draft',
    0,
    0,
    log_id,
    v_sale_order_id,
    now()
  )
  RETURNING id INTO v_quote_id;

  -- IMPORTANT: Only increment AFTER successful quote creation
  UPDATE company_settings
  SET quote_start_number = v_next_number + 1
  WHERE id = v_company_id;

  -- Get processes array
  v_processes := v_work_order_data->'processes';

  -- Loop through processes
  FOR i IN 0..(jsonb_array_length(v_processes) - 1) LOOP
    v_process := v_processes->i;
    
    -- Try to extract artwork URL safely
    v_artwork_url := NULL;
    
    BEGIN
      v_components := v_process->'components';
      
      IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' AND jsonb_array_length(v_components) > 0 THEN
        v_first_component := v_components->0;
        
        IF v_first_component IS NOT NULL THEN
          v_artwork_variations := v_first_component->'artworkVariations';
          
          IF v_artwork_variations IS NOT NULL AND jsonb_typeof(v_artwork_variations) = 'array' AND jsonb_array_length(v_artwork_variations) > 0 THEN
            v_first_variation := v_artwork_variations->0;
            
            IF v_first_variation IS NOT NULL THEN
              v_artwork_url := v_first_variation->>'imageSrc';
            END IF;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_artwork_url := NULL;
    END;
    
    -- Create Imprint for this process
    INSERT INTO quote_imprints (
      quote_id,
      company_id,
      imprint_number,
      type_of_work,
      details,
      artwork_url,
      created_at
    ) VALUES (
      v_quote_id,
      v_company_id,
      v_imprint_number::text,
      v_process->>'processName',
      v_process->>'processDescription',
      v_artwork_url,
      now()
    )
    RETURNING id INTO v_imprint_id;

    v_imprint_number := v_imprint_number + 1;

    -- Get products array
    v_products := v_process->'products';

    -- Loop through products
    FOR j IN 0..(jsonb_array_length(v_products) - 1) LOOP
      v_product := v_products->j;
      
      -- Get product colors array
      v_colors := v_product->'productColors';

      -- Loop through colors
      FOR k IN 0..(jsonb_array_length(v_colors) - 1) LOOP
        v_color := v_colors->k;
        
        -- Calculate total quantity
        SELECT COALESCE(SUM((size_elem->>'qty')::integer), 0)
        INTO v_total_qty
        FROM jsonb_array_elements(v_color->'sizes') AS size_elem;
        
        -- Build size data
        v_size_data := jsonb_build_object(
          'sizes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'size', size_elem->>'size',
                'quantity', (size_elem->>'qty')::integer
              )
            )
            FROM jsonb_array_elements(v_color->'sizes') AS size_elem
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
          v_product->>'productName' || ' - ' || 
          v_product->>'styleName' || ' - ' || 
          v_color->>'colorName',
          v_total_qty,
          (v_color->>'productPrice')::numeric,
          (v_color->>'productPrice')::numeric * v_total_qty,
          'Vendor: ' || COALESCE(v_product->>'vendorName', 'N/A') ||
          E'\nCost: $' || COALESCE(v_color->>'productCost', '0') ||
          E'\nSizes: ' || v_size_data::text,
          now()
        )
        RETURNING id INTO v_line_item_id;
      END LOOP;
    END LOOP;

    -- Get components array for decoration items
    v_components := v_process->'components';

    -- Loop through components (skip if null or empty)
    IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' AND jsonb_array_length(v_components) > 0 THEN
      FOR m IN 0..(jsonb_array_length(v_components) - 1) LOOP
        v_component := v_components->m;
        
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
          COALESCE((v_component->>'processPrice')::numeric, 0) * 
          COALESCE((v_component->>'qty')::integer, 0),
          v_component->>'typeCode',
          v_component->>'artworkLocationName',
          'Location: ' || COALESCE(v_component->>'artworkLocationName', '') ||
          E'\nNotes: ' || COALESCE(v_component->>'notes', ''),
          now()
        );
      END LOOP;
    END IF;
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

  RAISE NOTICE 'Successfully processed Chipply import % -> Quote %', log_id, v_quote_number;

EXCEPTION WHEN OTHERS THEN
  -- Mark import as failed and save error message
  UPDATE chipply_import_logs
  SET 
    status = 'failed',
    error_message = SQLERRM,
    updated_at = now()
  WHERE id = log_id;
  
  -- Re-raise the exception for logging
  RAISE;
END;
$$ LANGUAGE plpgsql;
