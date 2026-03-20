/*
  # Fix Chipply Pricing Extraction in Import Processor

  1. Problem
    - Chipply imports show $0.00 for unit_price and total_price
    - JSON path error: code looks for productPrice at color level, but it's at product level
    - Current: v_color->>'productPrice' (WRONG)
    - Correct: v_product->>'productPrice' (product level, applies to all colors)

  2. Changes
    - Drop and recreate process_chipply_import() function with correct pricing extraction
    - Extract productPrice from v_product instead of v_color
    - Calculate unit_price = productPrice and total_price = productPrice * total_qty
    - Update quote totals calculation to sum all line item total_price values

  3. Impact
    - New Chipply imports will have correct pricing automatically
    - Existing quotes need separate backfill migration (next step)
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS process_chipply_import(uuid);

-- Recreate with correct pricing extraction
CREATE OR REPLACE FUNCTION process_chipply_import(log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_raw_json jsonb;
  v_company_id uuid;
  v_account_summary jsonb;
  v_work_order_data jsonb;
  v_dealer_address jsonb;
  v_org_address jsonb;
  v_org_primary_contact jsonb;
  
  v_customer_company text;
  v_customer_first_name text;
  v_customer_last_name text;
  v_customer_contact_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_zip text;
  v_customer_id uuid;
  
  v_sale_order_id text;
  v_due_date date;
  v_notes text;
  v_nickname text;
  v_quote_number text;
  v_next_number integer;
  v_quote_id uuid;
  
  v_processes jsonb;
  v_process jsonb;
  v_process_name text;
  v_group_label text;
  
  v_products jsonb;
  v_product jsonb;
  v_colors jsonb;
  v_color jsonb;
  
  v_total_qty integer;
  v_size_data jsonb;
  v_size_elem jsonb;
  v_size_name text;
  v_size_qty integer;
  
  v_product_price numeric;
  v_unit_price numeric;
  v_total_price numeric;
  
  v_garment_front_image_url text;
  v_garment_back_image_url text;
  v_garment_side_image_url text;
  
  v_line_item_id uuid;
  
  v_components jsonb;
  v_component jsonb;
  v_component_name text;
  v_component_location text;
  v_artwork_variations jsonb;
  v_variation jsonb;
  v_artwork_urls text[];
  v_artwork_url text;
  
  v_imprint_id uuid;
  v_imprint_number integer;
  
  v_proof_id uuid;
  
  v_quote_subtotal numeric := 0;
  v_quote_total numeric := 0;
  
  i integer;
  j integer;
  k integer;
  m integer;
  n integer;
BEGIN
  -- Get the raw JSON and company_id from the log
  SELECT raw_json->0, company_id
  INTO v_raw_json, v_company_id
  FROM chipply_import_logs
  WHERE id = log_id;

  IF v_raw_json IS NULL THEN
    RAISE EXCEPTION 'No data found for log_id %', log_id;
  END IF;

  -- Extract main sections
  v_account_summary := v_raw_json->'accountSummary';
  v_work_order_data := v_raw_json->'workOrderData';
  v_dealer_address := v_raw_json->'dealerAddress';
  v_org_address := v_raw_json->'organizationAddress';
  v_org_primary_contact := v_raw_json->'organizationPrimaryContactName';

  -- Extract customer information from organization address
  v_customer_company := COALESCE(v_org_address->>'companyName', v_account_summary->>'customerName');
  v_customer_first_name := COALESCE(v_org_primary_contact->>'firstName', v_org_address->>'nameFirst');
  v_customer_last_name := COALESCE(v_org_primary_contact->>'lastName', v_org_address->>'nameLast');
  v_customer_contact_name := TRIM(COALESCE(v_customer_first_name || ' ' || v_customer_last_name, ''));
  v_customer_email := v_account_summary->>'contactEmail';
  v_customer_phone := v_account_summary->>'contactPhone';
  v_customer_zip := v_org_address->>'zipCode';

  -- Extract order details
  v_sale_order_id := v_account_summary->>'saleOrder';
  v_due_date := (v_account_summary->>'dueDate')::date;

  -- Generate nickname from due date
  v_nickname := 'Batched ' || TO_CHAR(v_due_date, 'MM/DD/YYYY');

  RAISE NOTICE 'Processing Chipply import for customer: % (email: %)', v_customer_company, v_customer_email;

  -- Look up or create customer
  IF v_customer_email IS NOT NULL AND v_customer_email != '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE company_id = v_company_id
      AND email = v_customer_email
    LIMIT 1;

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
    v_group_label := v_process_name;

    -- Get products array for this process
    v_products := v_process->'products';

    -- Loop through products and create line items
    FOR j IN 0..(jsonb_array_length(v_products) - 1) LOOP
      v_product := v_products->j;
      
      -- CRITICAL FIX: Extract productPrice from PRODUCT level (not color level)
      v_product_price := COALESCE((v_product->>'productPrice')::numeric, 0);
      
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
        
        -- Initialize all size columns to 0
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
            WHEN '5XL', 'XXXXXL' THEN v_size_data := jsonb_set(v_size_data, '{qty_5xl}', to_jsonb(v_size_qty));
            WHEN 'OSFM', 'OS', 'ONE SIZE' THEN v_size_data := jsonb_set(v_size_data, '{qty_m}', to_jsonb(v_size_qty));
            ELSE
              RAISE NOTICE 'Unmapped size: %', v_size_name;
          END CASE;
        END LOOP;
        
        -- Calculate pricing using product-level price
        v_unit_price := v_product_price;
        v_total_price := v_product_price * v_total_qty;
        
        -- Create line item with correct pricing
        INSERT INTO quote_line_items (
          quote_id,
          line_type,
          description,
          quantity,
          unit_price,
          total_price,
          group_label,
          garment_front_image_url,
          garment_back_image_url,
          garment_side_image_url,
          qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl,
          qty_xs, qty_s, qty_m, qty_l, qty_xl,
          qty_2xl, qty_3xl, qty_4xl, qty_5xl,
          created_at
        ) VALUES (
          v_quote_id,
          'garment',
          (v_product->>'vendorName') || ' - ' || 
          (v_product->>'productName') || ' - ' || 
          (v_product->>'styleName') || ' - ' || 
          (v_color->>'colorName'),
          v_total_qty,
          v_unit_price,
          v_total_price,
          v_group_label,
          v_garment_front_image_url,
          v_garment_back_image_url,
          v_garment_side_image_url,
          (v_size_data->>'qty_yxs')::integer,
          (v_size_data->>'qty_ys')::integer,
          (v_size_data->>'qty_ym')::integer,
          (v_size_data->>'qty_yl')::integer,
          (v_size_data->>'qty_yxl')::integer,
          (v_size_data->>'qty_xs')::integer,
          (v_size_data->>'qty_s')::integer,
          (v_size_data->>'qty_m')::integer,
          (v_size_data->>'qty_l')::integer,
          (v_size_data->>'qty_xl')::integer,
          (v_size_data->>'qty_2xl')::integer,
          (v_size_data->>'qty_3xl')::integer,
          (v_size_data->>'qty_4xl')::integer,
          (v_size_data->>'qty_5xl')::integer,
          now()
        )
        RETURNING id INTO v_line_item_id;
        
        RAISE NOTICE 'Created line item: % (qty: %, unit_price: %, total: %)', 
          v_product->>'productName', v_total_qty, v_unit_price, v_total_price;
        
      END LOOP; -- colors
    END LOOP; -- products

    -- Process imprints for this process group
    v_components := v_process->'components';
    v_imprint_number := 1;

    FOR m IN 0..(jsonb_array_length(v_components) - 1) LOOP
      v_component := v_components->m;
      v_component_name := v_component->>'artworkName';
      v_component_location := v_component->>'artworkLocationName';

      -- Create the imprint
      INSERT INTO quote_imprints (
        quote_id,
        imprint_method,
        location,
        group_label,
        imprint_number,
        created_at
      ) VALUES (
        v_quote_id,
        v_process_name,
        v_component_location,
        v_group_label,
        v_imprint_number,
        now()
      )
      RETURNING id INTO v_imprint_id;

      v_imprint_number := v_imprint_number + 1;

      -- Process artwork variations and create proofs
      v_artwork_variations := v_component->'artworkVariations';

      IF jsonb_array_length(v_artwork_variations) > 0 THEN
        FOR n IN 0..(jsonb_array_length(v_artwork_variations) - 1) LOOP
          v_variation := v_artwork_variations->n;
          
          -- Extract artwork URLs from variation
          v_artwork_urls := ARRAY[]::text[];
          v_artwork_url := v_variation->>'imageSrc';
          IF v_artwork_url IS NOT NULL AND v_artwork_url != '' THEN
            v_artwork_urls := array_append(v_artwork_urls, v_artwork_url);
          END IF;

          -- Update imprint with artwork URLs
          UPDATE quote_imprints
          SET artwork_image_urls = v_artwork_urls
          WHERE id = v_imprint_id;

          -- Create proof for this artwork variation
          INSERT INTO proofs (
            quote_id,
            imprint_id,
            group_label,
            decoration_colors,
            status,
            created_at
          ) VALUES (
            v_quote_id,
            v_imprint_id,
            v_group_label,
            v_variation->>'decorationColor',
            'pending_artwork',
            now()
          )
          RETURNING id INTO v_proof_id;

        END LOOP;
      END IF;

    END LOOP; -- components

  END LOOP; -- processes

  -- Calculate and update quote totals
  SELECT 
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(total_price), 0)
  INTO v_quote_subtotal, v_quote_total
  FROM quote_line_items
  WHERE quote_id = v_quote_id;

  UPDATE quotes
  SET 
    subtotal = v_quote_subtotal,
    total = v_quote_total
  WHERE id = v_quote_id;

  RAISE NOTICE 'Updated quote totals - Subtotal: %, Total: %', v_quote_subtotal, v_quote_total;

  -- Mark the import as processed
  UPDATE chipply_import_logs
  SET 
    status = 'processed',
    processed_at = now(),
    quote_id = v_quote_id
  WHERE id = log_id;

  RAISE NOTICE 'Successfully processed Chipply import log %', log_id;

END;
$$;
