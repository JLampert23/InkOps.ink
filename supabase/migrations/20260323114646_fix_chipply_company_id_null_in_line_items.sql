/*
  # Fix Chipply Import Company ID Null Error
  
  1. Problem
    - When inserting quote_line_items during Chipply import, company_id is coming through as NULL
    - This violates the NOT NULL constraint on quote_line_items.company_id
  
  2. Root Cause
    - The v_company_id variable is properly set from the log record
    - However, there may be a transaction isolation issue or the variable is being referenced incorrectly
  
  3. Solution
    - Add explicit NULL check and error handling
    - Ensure company_id is properly propagated from chipply_import_logs to all child records
    - Add defensive check to prevent NULL company_id from ever being inserted
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
  v_customer_first_name text;
  v_customer_last_name text;
  v_customer_contact_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_company text;
  v_customer_id uuid;
  v_due_date date;
  v_notes text;
  v_nickname text;
  v_store_name text;
  v_batch_id text;
  v_batch_date date;
  v_sale_order_id text;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_proof_id uuid;
  v_imprint_number integer := 1;
  v_proof_counter integer := 1;
  v_size_data jsonb;
  v_account_summary jsonb;
  v_org_address jsonb;
  v_org_contact_name jsonb;
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
  v_artwork_variations jsonb;
  v_artwork_images jsonb;
  v_artwork_url text;
  v_existing_quote_id uuid;
  v_description text;
  v_line_notes text;
  v_group_label text;
  v_process_name text;
  v_garment_front_image_url text;
  v_garment_back_image_url text;
  v_garment_side_image_url text;
  v_garment_images_array jsonb;
  v_size_elem jsonb;
  v_size_name text;
  v_size_qty integer;
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

  -- CRITICAL: Extract and validate company_id immediately
  v_company_id := v_log_record.company_id;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is NULL in chipply_import_logs for log_id: %', log_id;
  END IF;
  
  RAISE NOTICE 'Processing import for company_id: %', v_company_id;

  -- IDEMPOTENCY CHECK: Skip if already processed
  IF v_log_record.status = 'processed' THEN
    RAISE NOTICE 'Import log % already processed, skipping', log_id;
    RETURN;
  END IF;

  v_payload := v_log_record.raw_json;

  -- Handle array wrapper if present
  IF jsonb_typeof(v_payload) = 'array' THEN
    v_payload := v_payload->0;
  END IF;

  -- Extract top-level objects
  v_account_summary := v_payload->'accountSummary';
  v_org_address := v_payload->'organizationAddress';
  v_org_contact_name := v_payload->'organizationPrimaryContactName';
  v_work_order_data := v_payload->'workOrderData';

  -- Extract customer data from correct JSON paths
  v_customer_email := v_account_summary->>'contactEmail';
  v_customer_phone := v_account_summary->>'contactPhone';
  v_customer_name := v_account_summary->>'customerName';
  v_customer_company := v_org_address->>'companyName';
  v_customer_first_name := v_org_contact_name->>'firstName';
  v_customer_last_name := v_org_contact_name->>'lastName';
  v_due_date := (v_account_summary->>'dueDate')::date;
  v_sale_order_id := v_account_summary->>'saleOrder';
  
  -- Extract data for nickname
  v_store_name := v_account_summary->>'parentStoreName';
  v_batch_id := v_account_summary->>'batchId';
  
  -- Try to extract batch date (might be in various fields)
  BEGIN
    v_batch_date := (v_account_summary->>'batchDate')::date;
  EXCEPTION WHEN OTHERS THEN
    v_batch_date := NULL;
  END;

  -- Build contact name from first and last name
  IF v_customer_first_name IS NOT NULL AND v_customer_last_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_first_name || ' ' || v_customer_last_name;
  ELSIF v_customer_first_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_first_name;
  ELSIF v_customer_last_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_last_name;
  ELSE
    v_customer_contact_name := v_customer_name;
  END IF;

  -- Fallback for company name if not provided
  IF v_customer_company IS NULL OR v_customer_company = '' THEN
    v_customer_company := COALESCE(v_customer_name, 'Chipply Customer');
  END IF;

  -- Build nickname with human-readable date format
  v_nickname := '';
  IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
    v_nickname := v_store_name;
  ELSE
    v_nickname := 'Chipply Import';
  END IF;
  
  IF v_batch_id IS NOT NULL AND v_batch_id <> '' THEN
    v_nickname := v_nickname || ' - Batch ' || v_batch_id;
  END IF;
  
  IF v_batch_date IS NOT NULL THEN
    v_nickname := v_nickname || ' - ' || TO_CHAR(v_batch_date, 'Mon DD, YYYY');
  ELSIF v_due_date IS NOT NULL THEN
    v_nickname := v_nickname || ' - ' || TO_CHAR(v_due_date, 'Mon DD, YYYY');
  END IF;

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

    -- Create customer if not found
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (
        company_id,
        company_name,
        contact_name,
        primary_contact_first_name,
        primary_contact_last_name,
        email,
        phone,
        created_at
      ) VALUES (
        v_company_id,
        v_customer_company,
        v_customer_contact_name,
        v_customer_first_name,
        v_customer_last_name,
        v_customer_email,
        v_customer_phone,
        now()
      )
      RETURNING id INTO v_customer_id;
      
      RAISE NOTICE 'Created new customer: % (email: %)', v_customer_company, v_customer_email;
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
  FOR UPDATE;

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
    nickname,
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
    v_customer_contact_name,
    v_customer_email,
    v_customer_phone,
    v_customer_company,
    v_due_date,
    v_notes,
    v_nickname,
    'draft',
    0,
    0,
    log_id,
    v_sale_order_id,
    now()
  )
  RETURNING id INTO v_quote_id;

  RAISE NOTICE 'Created quote % for customer %', v_quote_number, v_customer_company;

  -- IMPORTANT: Only increment AFTER successful quote creation
  UPDATE company_settings
  SET quote_start_number = v_next_number + 1
  WHERE id = v_company_id;

  -- Get processes array
  v_processes := v_work_order_data->'processes';

  -- Loop through processes - each becomes a separate group
  FOR i IN 0..(jsonb_array_length(v_processes) - 1) LOOP
    v_process := v_processes->i;
    v_process_name := v_process->>'processName';
    
    -- Create group label for this process
    v_group_label := 'Process ' || (i + 1)::text || ': ' || COALESCE(v_process_name, 'Unnamed Process');
    
    RAISE NOTICE 'Processing group: %', v_group_label;
    
    -- Get components for this process and create imprints
    v_components := v_process->'components';
    
    IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' AND jsonb_array_length(v_components) > 0 THEN
      FOR m IN 0..(jsonb_array_length(v_components) - 1) LOOP
        v_component := v_components->m;
        
        -- Extract all artwork variations into an array
        v_artwork_variations := v_component->'artworkVariations';
        v_artwork_images := '[]'::jsonb;
        v_artwork_url := NULL;
        
        IF v_artwork_variations IS NOT NULL AND jsonb_typeof(v_artwork_variations) = 'array' AND jsonb_array_length(v_artwork_variations) > 0 THEN
          -- Build array of image URLs
          SELECT jsonb_agg(variation->>'imageSrc')
          INTO v_artwork_images
          FROM jsonb_array_elements(v_artwork_variations) AS variation
          WHERE variation->>'imageSrc' IS NOT NULL;
          
          -- Get first image as primary artwork_url
          v_artwork_url := v_artwork_variations->0->>'imageSrc';
        END IF;
        
        -- DEFENSIVE CHECK: Ensure company_id is not NULL before inserting
        IF v_company_id IS NULL THEN
          RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_imprints';
        END IF;
        
        -- Create Imprint for this component with group_label
        INSERT INTO quote_imprints (
          quote_id,
          company_id,
          group_label,
          imprint_number,
          type_of_work,
          location,
          details,
          artwork_url,
          artwork_images,
          created_at
        ) VALUES (
          v_quote_id,
          v_company_id,
          v_group_label,
          v_imprint_number::text,
          v_process_name,
          v_component->>'artworkLocationName',
          COALESCE(v_component->>'artworkName', '') || ' - ' || COALESCE(v_component->>'notes', ''),
          v_artwork_url,
          COALESCE(v_artwork_images, '[]'::jsonb),
          now()
        )
        RETURNING id INTO v_imprint_id;

        RAISE NOTICE 'Created imprint % for group % with % artwork images', 
          v_imprint_number, v_group_label, jsonb_array_length(COALESCE(v_artwork_images, '[]'::jsonb));

        v_imprint_number := v_imprint_number + 1;
      END LOOP;
    END IF;

    -- Get products array for this process
    v_products := v_process->'products';

    -- Loop through products and create line items
    FOR j IN 0..(jsonb_array_length(v_products) - 1) LOOP
      v_product := v_products->j;
      
      -- Get product colors array
      v_colors := v_product->'productColors';

      -- Loop through colors - each becomes a line item
      FOR k IN 0..(jsonb_array_length(v_colors) - 1) LOOP
        v_color := v_colors->k;
        
        -- Extract garment images using correct column names
        v_garment_front_image_url := v_color->>'image1Url';
        v_garment_back_image_url := v_color->>'image2Url';
        v_garment_side_image_url := v_color->>'image3Url';
        
        -- Calculate total quantity and parse individual sizes
        v_total_qty := 0;
        
        -- Initialize all size columns to 0 (using only existing columns)
        v_size_data := jsonb_build_object(
          'qty_yxs', 0, 'qty_ys', 0, 'qty_ym', 0, 'qty_yl', 0, 'qty_yxl', 0,
          'qty_xs', 0, 'qty_s', 0, 'qty_m', 0, 'qty_l', 0, 'qty_xl', 0,
          'qty_2xl', 0, 'qty_3xl', 0, 'qty_4xl', 0, 'qty_5xl', 0
        );
        
        -- Parse sizes from Chipply data
        FOR v_size_elem IN SELECT * FROM jsonb_array_elements(v_color->'sizes')
        LOOP
          v_size_name := UPPER(TRIM(v_size_elem->>'size'));
          v_size_qty := (v_size_elem->>'qty')::integer;
          v_total_qty := v_total_qty + v_size_qty;
          
          -- Map Chipply size names to our column names
          CASE v_size_name
            WHEN 'YXS' THEN v_size_data := jsonb_set(v_size_data, '{qty_yxs}', to_jsonb(v_size_qty));
            WHEN 'YS' THEN v_size_data := jsonb_set(v_size_data, '{qty_ys}', to_jsonb(v_size_qty));
            WHEN 'YM' THEN v_size_data := jsonb_set(v_size_data, '{qty_ym}', to_jsonb(v_size_qty));
            WHEN 'YL' THEN v_size_data := jsonb_set(v_size_data, '{qty_yl}', to_jsonb(v_size_qty));
            WHEN 'YXL' THEN v_size_data := jsonb_set(v_size_data, '{qty_yxl}', to_jsonb(v_size_qty));
            WHEN 'XS' THEN v_size_data := jsonb_set(v_size_data, '{qty_xs}', to_jsonb(v_size_qty));
            WHEN 'S' THEN v_size_data := jsonb_set(v_size_data, '{qty_s}', to_jsonb(v_size_qty));
            WHEN 'M' THEN v_size_data := jsonb_set(v_size_data, '{qty_m}', to_jsonb(v_size_qty));
            WHEN 'L' THEN v_size_data := jsonb_set(v_size_data, '{qty_l}', to_jsonb(v_size_qty));
            WHEN 'XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_xl}', to_jsonb(v_size_qty));
            WHEN '2XL', 'XXL' THEN v_size_data := jsonb_set(v_size_data, '{qty_2xl}', to_jsonb(v_size_qty));
            WHEN '3XL', 'XXXL' THEN v_size_data := jsonb_set(v_size_data, '{qty_3xl}', to_jsonb(v_size_qty));
            WHEN '4XL', 'XXXXL' THEN v_size_data := jsonb_set(v_size_data, '{qty_4xl}', to_jsonb(v_size_qty));
            WHEN '5XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_5xl}', to_jsonb(v_size_qty));
          END CASE;
        END LOOP;

        -- Build description
        v_description := COALESCE(v_product->>'productName', '') || ' - ' || 
                        COALESCE(v_product->>'styleName', '') || ' - ' || 
                        COALESCE(v_color->>'colorName', '');
        
        v_line_notes := 'Vendor: ' || COALESCE(v_product->>'vendorName', 'N/A') ||
                       E'\nStyle: ' || COALESCE(v_product->>'styleNumber', 'N/A') ||
                       E'\nColor: ' || COALESCE(v_color->>'colorName', 'N/A');

        -- DEFENSIVE CHECK: Ensure company_id is not NULL before inserting
        IF v_company_id IS NULL THEN
          RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_line_items (process: %, product: %, color: %)', i, j, k;
        END IF;

        -- Create Line Item for this garment color with group_label
        -- Set quantity to 0 to avoid double-counting (sizes already have the breakdown)
        INSERT INTO quote_line_items (
          quote_id,
          company_id,
          group_label,
          line_type,
          description,
          item_number,
          color,
          quantity,
          qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl,
          qty_xs, qty_s, qty_m, qty_l, qty_xl,
          qty_2xl, qty_3xl, qty_4xl, qty_5xl,
          unit_price,
          total_price,
          notes,
          garment_front_image_url,
          garment_back_image_url,
          garment_side_image_url,
          created_at
        ) VALUES (
          v_quote_id,
          v_company_id,
          v_group_label,
          'item',
          v_description,
          v_product->>'styleNumber',
          v_color->>'colorName',
          0,
          (v_size_data->>'qty_yxs')::integer, (v_size_data->>'qty_ys')::integer, 
          (v_size_data->>'qty_ym')::integer, (v_size_data->>'qty_yl')::integer, 
          (v_size_data->>'qty_yxl')::integer,
          (v_size_data->>'qty_xs')::integer, (v_size_data->>'qty_s')::integer, 
          (v_size_data->>'qty_m')::integer, (v_size_data->>'qty_l')::integer, 
          (v_size_data->>'qty_xl')::integer, (v_size_data->>'qty_2xl')::integer,
          (v_size_data->>'qty_3xl')::integer, (v_size_data->>'qty_4xl')::integer, 
          (v_size_data->>'qty_5xl')::integer,
          COALESCE((v_color->>'productPrice')::numeric, 0),
          COALESCE((v_color->>'productPrice')::numeric, 0) * v_total_qty,
          v_line_notes,
          v_garment_front_image_url,
          v_garment_back_image_url,
          v_garment_side_image_url,
          now()
        )
        RETURNING id INTO v_line_item_id;

        RAISE NOTICE 'Created line item for group % with % total quantity', v_group_label, v_total_qty;

        -- Create proof if we have garment images
        IF v_garment_front_image_url IS NOT NULL THEN
          -- Get the first imprint in this group to link the proof
          SELECT id INTO v_imprint_id
          FROM quote_imprints
          WHERE quote_id = v_quote_id
          AND group_label = v_group_label
          ORDER BY created_at
          LIMIT 1;

          -- DEFENSIVE CHECK: Ensure company_id is not NULL before inserting
          IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'FATAL: company_id became NULL before inserting proofs';
          END IF;

          INSERT INTO proofs (
            quote_id,
            line_item_id,
            imprint_id,
            company_id,
            group_label,
            proof_number,
            garment_image_url,
            status,
            created_at
          ) VALUES (
            v_quote_id,
            v_line_item_id,
            v_imprint_id,
            v_company_id,
            v_group_label,
            v_quote_number || '-P' || LPAD(v_proof_counter::text, 3, '0'),
            v_garment_front_image_url,
            'draft',
            now()
          )
          RETURNING id INTO v_proof_id;

          RAISE NOTICE 'Created proof % for line item with garment images', v_proof_counter;
          
          v_proof_counter := v_proof_counter + 1;
        END IF;
      END LOOP;
    END LOOP;
    
    -- After creating all line items for this group, collect garment images and update imprints
    SELECT jsonb_agg(DISTINCT img_obj)
    INTO v_garment_images_array
    FROM (
      SELECT jsonb_build_object('url', garment_front_image_url, 'view', 'front') AS img_obj
      FROM quote_line_items
      WHERE quote_id = v_quote_id
      AND group_label = v_group_label
      AND garment_front_image_url IS NOT NULL
      
      UNION ALL
      
      SELECT jsonb_build_object('url', garment_back_image_url, 'view', 'back') AS img_obj
      FROM quote_line_items
      WHERE quote_id = v_quote_id
      AND group_label = v_group_label
      AND garment_back_image_url IS NOT NULL
      
      UNION ALL
      
      SELECT jsonb_build_object('url', garment_side_image_url, 'view', 'side') AS img_obj
      FROM quote_line_items
      WHERE quote_id = v_quote_id
      AND group_label = v_group_label
      AND garment_side_image_url IS NOT NULL
    ) imgs;
    
    -- Update all imprints in this group with garment images
    IF v_garment_images_array IS NOT NULL THEN
      UPDATE quote_imprints
      SET garment_images = COALESCE(v_garment_images_array, '[]'::jsonb)
      WHERE quote_id = v_quote_id
      AND group_label = v_group_label;
      
      RAISE NOTICE 'Updated imprints in group % with % garment images', 
        v_group_label, jsonb_array_length(COALESCE(v_garment_images_array, '[]'::jsonb));
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
$$ LANGUAGE plpgsql SECURITY DEFINER;