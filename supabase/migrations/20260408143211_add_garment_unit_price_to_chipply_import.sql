/*
  # Add Garment Unit Price to Chipply Import Functions

  ## Purpose
  Set the `garment_unit_price` column on quote_line_items during Chipply import.
  This ensures the selling price from Chipply (productPrice) populates the unit price column.

  ## Changes
  1. Update trigger function `process_chipply_import()` to include `garment_unit_price`
  2. Update standalone function `process_chipply_import(uuid)` to include `garment_unit_price`
  
  ## Field Mapping
  - Chipply `productPrice` -> `unit_price` (already mapped)
  - Chipply `productPrice` -> `garment_unit_price` (NEW - selling price)
*/

-- Update the trigger function
CREATE OR REPLACE FUNCTION process_chipply_import()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_data jsonb;
  v_process jsonb;
  v_product jsonb;
  v_color jsonb;
  v_size jsonb;
  v_decoration jsonb;
  v_artwork jsonb;
  v_quote_id uuid;
  v_quote_number text;
  v_customer_id uuid;
  v_company_id uuid;
  v_line_item_id uuid;
  v_imprint_id uuid;
  v_proof_id uuid;
  v_proof_counter integer := 1;
  v_group_label text;
  v_process_counter integer := 1;
  v_size_data jsonb;
  v_total_qty integer;
  v_description text;
  v_line_notes text;
  v_size_mapping jsonb := '{
    "YXS": "qty_yxs", "YS": "qty_ys", "YM": "qty_ym", "YL": "qty_yl", "YXL": "qty_yxl",
    "XS": "qty_xs", "S": "qty_s", "M": "qty_m", "L": "qty_l", "XL": "qty_xl",
    "2XL": "qty_2xl", "3XL": "qty_3xl", "4XL": "qty_4xl", "5XL": "qty_5xl",
    "2X": "qty_2xl", "3X": "qty_3xl", "4X": "qty_4xl", "5X": "qty_5xl",
    "XXL": "qty_2xl", "XXXL": "qty_3xl", "XXXXL": "qty_4xl", "XXXXXL": "qty_5xl",
    "SM": "qty_s", "MD": "qty_m", "LG": "qty_l",
    "Adult S": "qty_s", "Adult M": "qty_m", "Adult L": "qty_l", "Adult XL": "qty_xl",
    "Adult 2XL": "qty_2xl", "Adult 3XL": "qty_3xl", "Adult 4XL": "qty_4xl", "Adult 5XL": "qty_5xl",
    "Youth XS": "qty_yxs", "Youth S": "qty_ys", "Youth M": "qty_ym", "Youth L": "qty_yl", "Youth XL": "qty_yxl"
  }'::jsonb;
  v_size_key text;
  v_size_column text;
  v_garment_front_image_url text;
  v_garment_back_image_url text;
  v_garment_side_image_url text;
  v_artwork_urls text[];
  i integer;
  j integer;
  k integer;
  m integer;
  v_next_quote_num integer;
  v_prefix text;
  v_customer_email text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_first_name text;
  v_customer_last_name text;
  v_billing_address text;
  v_billing_city text;
  v_billing_state text;
  v_billing_zip text;
  v_nickname text;
  v_sale_order_id text;
  v_existing_quote_id uuid;
BEGIN
  IF NEW.status = 'pending' THEN
    v_work_order_data := NEW.raw_json->0->'workOrderData';
    
    IF v_work_order_data IS NULL THEN
      UPDATE chipply_import_logs 
      SET status = 'error', 
          error_message = 'No workOrderData found in payload',
          updated_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
    
    v_company_id := NEW.company_id;
    
    IF v_company_id IS NULL THEN
      UPDATE chipply_import_logs 
      SET status = 'error', 
          error_message = 'No company_id found for import',
          updated_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
    
    -- Check for duplicate sale order
    v_sale_order_id := NEW.raw_json->0->'accountSummary'->>'saleOrder';
    
    IF v_sale_order_id IS NOT NULL THEN
      SELECT id INTO v_existing_quote_id
      FROM quotes
      WHERE company_id = v_company_id
      AND chipply_sale_order_id = v_sale_order_id
      LIMIT 1;
      
      IF v_existing_quote_id IS NOT NULL THEN
        UPDATE chipply_import_logs 
        SET status = 'processed',
            error_message = 'Duplicate import - sale order ' || v_sale_order_id || ' already exists as quote ' || 
              (SELECT quote_number FROM quotes WHERE id = v_existing_quote_id),
            updated_at = now()
        WHERE id = NEW.id;
        RETURN NEW;
      END IF;
    END IF;
    
    -- Extract customer info
    v_customer_email := COALESCE(
      NEW.raw_json->0->'organizationPrimaryContactName'->>'email',
      NEW.raw_json->0->'accountSummary'->>'email',
      ''
    );
    v_customer_name := COALESCE(
      NEW.raw_json->0->'organizationPrimaryContactName'->>'organizationName',
      NEW.raw_json->0->'accountSummary'->>'organizationName',
      ''
    );
    v_customer_phone := COALESCE(
      NEW.raw_json->0->'organizationPrimaryContactName'->>'phone',
      NEW.raw_json->0->'accountSummary'->>'phone',
      ''
    );
    v_customer_first_name := COALESCE(
      NEW.raw_json->0->'organizationPrimaryContactName'->>'firstName',
      ''
    );
    v_customer_last_name := COALESCE(
      NEW.raw_json->0->'organizationPrimaryContactName'->>'lastName',
      ''
    );
    
    v_billing_address := COALESCE(
      NEW.raw_json->0->'organizationAddress'->>'street1',
      ''
    );
    v_billing_city := COALESCE(
      NEW.raw_json->0->'organizationAddress'->>'city',
      ''
    );
    v_billing_state := COALESCE(
      NEW.raw_json->0->'organizationAddress'->>'state',
      ''
    );
    v_billing_zip := COALESCE(
      NEW.raw_json->0->'organizationAddress'->>'zip',
      ''
    );
    
    -- Find or create customer
    IF v_customer_email != '' AND v_customer_email IS NOT NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE company_id = v_company_id
      AND LOWER(email) = LOWER(v_customer_email)
      LIMIT 1;
      
      IF v_customer_id IS NULL THEN
        INSERT INTO customers (
          company_id,
          name,
          email,
          phone,
          primary_first_name,
          primary_last_name,
          billing_address,
          billing_city,
          billing_state,
          billing_zip,
          created_at
        ) VALUES (
          v_company_id,
          v_customer_name,
          v_customer_email,
          v_customer_phone,
          v_customer_first_name,
          v_customer_last_name,
          v_billing_address,
          v_billing_city,
          v_billing_state,
          v_billing_zip,
          now()
        )
        RETURNING id INTO v_customer_id;
      END IF;
    END IF;
    
    -- Generate quote number
    SELECT COALESCE(quote_prefix, 'QTE-') INTO v_prefix
    FROM company_settings
    WHERE company_id = v_company_id;
    
    IF v_prefix IS NULL THEN
      v_prefix := 'QTE-';
    END IF;
    
    SELECT COALESCE(MAX(
      CASE 
        WHEN quote_number ~ ('^' || v_prefix || '[0-9]+$')
        THEN CAST(SUBSTRING(quote_number FROM LENGTH(v_prefix) + 1) AS INTEGER)
        ELSE 0
      END
    ), 0) + 1 INTO v_next_quote_num
    FROM quotes
    WHERE company_id = v_company_id
    AND quote_number LIKE v_prefix || '%';
    
    v_quote_number := v_prefix || LPAD(v_next_quote_num::text, 4, '0');
    
    -- Build nickname
    v_nickname := COALESCE(
      v_work_order_data->>'eventName',
      'Chipply Import ' || to_char(now(), 'MM/DD/YYYY')
    );
    
    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'FATAL: company_id is NULL before creating quote';
    END IF;
    
    -- Create quote
    INSERT INTO quotes (
      company_id,
      quote_number,
      nickname,
      status,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      billing_first_name,
      billing_last_name,
      billing_address,
      billing_city,
      billing_state,
      billing_zip,
      chipply_import_log_id,
      chipply_sale_order_id,
      created_at
    ) VALUES (
      v_company_id,
      v_quote_number,
      v_nickname,
      'draft',
      v_customer_id,
      v_customer_name,
      v_customer_email,
      v_customer_phone,
      v_customer_first_name,
      v_customer_last_name,
      v_billing_address,
      v_billing_city,
      v_billing_state,
      v_billing_zip,
      NEW.id,
      v_sale_order_id,
      now()
    )
    RETURNING id INTO v_quote_id;
    
    -- Process each process/group
    FOR i IN 0..jsonb_array_length(v_work_order_data->'processes') - 1 LOOP
      v_process := v_work_order_data->'processes'->i;
      v_group_label := 'Group ' || v_process_counter;
      
      -- Create imprints from decorations
      IF v_process->'decorations' IS NOT NULL AND jsonb_array_length(v_process->'decorations') > 0 THEN
        FOR m IN 0..jsonb_array_length(v_process->'decorations') - 1 LOOP
          v_decoration := v_process->'decorations'->m;
          
          v_artwork_urls := ARRAY[]::text[];
          IF v_decoration->'artworks' IS NOT NULL AND jsonb_array_length(v_decoration->'artworks') > 0 THEN
            FOR j IN 0..jsonb_array_length(v_decoration->'artworks') - 1 LOOP
              v_artwork := v_decoration->'artworks'->j;
              IF v_artwork->>'artworkUrl' IS NOT NULL THEN
                v_artwork_urls := array_append(v_artwork_urls, v_artwork->>'artworkUrl');
              END IF;
            END LOOP;
          END IF;
          
          IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_imprints';
          END IF;
          
          INSERT INTO quote_imprints (
            quote_id,
            company_id,
            group_label,
            imprint_number,
            location,
            type_of_work,
            colors,
            notes,
            artwork_urls,
            created_at
          ) VALUES (
            v_quote_id,
            v_company_id,
            v_group_label,
            m + 1,
            COALESCE(v_decoration->>'location', 'Front'),
            COALESCE(v_decoration->>'decorationType', 'Screen Print'),
            COALESCE((v_decoration->>'numberOfColors')::integer, 1),
            v_decoration->>'decorationNotes',
            v_artwork_urls,
            now()
          )
          RETURNING id INTO v_imprint_id;
        END LOOP;
      END IF;
      
      -- Process products
      FOR j IN 0..jsonb_array_length(v_process->'products') - 1 LOOP
        v_product := v_process->'products'->j;
        
        FOR k IN 0..jsonb_array_length(v_product->'productColors') - 1 LOOP
          v_color := v_product->'productColors'->k;
          
          -- Get garment images
          v_garment_front_image_url := NULL;
          v_garment_back_image_url := NULL;
          v_garment_side_image_url := NULL;
          
          IF v_color->>'image1Url' IS NOT NULL AND v_color->>'image1Url' != '' THEN
            v_garment_front_image_url := v_color->>'image1Url';
          END IF;
          IF v_color->>'image2Url' IS NOT NULL AND v_color->>'image2Url' != '' THEN
            v_garment_back_image_url := v_color->>'image2Url';
          END IF;
          IF v_color->>'image3Url' IS NOT NULL AND v_color->>'image3Url' != '' THEN
            v_garment_side_image_url := v_color->>'image3Url';
          END IF;
          
          -- Initialize size data
          v_size_data := '{"qty_yxs": 0, "qty_ys": 0, "qty_ym": 0, "qty_yl": 0, "qty_yxl": 0, "qty_xs": 0, "qty_s": 0, "qty_m": 0, "qty_l": 0, "qty_xl": 0, "qty_2xl": 0, "qty_3xl": 0, "qty_4xl": 0, "qty_5xl": 0}'::jsonb;
          v_total_qty := 0;
          
          -- Process sizes
          FOR m IN 0..jsonb_array_length(v_color->'sizes') - 1 LOOP
            v_size := v_color->'sizes'->m;
            v_size_key := UPPER(TRIM(v_size->>'size'));
            v_size_column := v_size_mapping->>v_size_key;
            
            CASE v_size_key
              WHEN 'YXS', 'YOUTH XS' THEN v_size_data := jsonb_set(v_size_data, '{qty_yxs}', to_jsonb(COALESCE((v_size_data->>'qty_yxs')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'YS', 'YOUTH S' THEN v_size_data := jsonb_set(v_size_data, '{qty_ys}', to_jsonb(COALESCE((v_size_data->>'qty_ys')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'YM', 'YOUTH M' THEN v_size_data := jsonb_set(v_size_data, '{qty_ym}', to_jsonb(COALESCE((v_size_data->>'qty_ym')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'YL', 'YOUTH L' THEN v_size_data := jsonb_set(v_size_data, '{qty_yl}', to_jsonb(COALESCE((v_size_data->>'qty_yl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'YXL', 'YOUTH XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_yxl}', to_jsonb(COALESCE((v_size_data->>'qty_yxl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'XS' THEN v_size_data := jsonb_set(v_size_data, '{qty_xs}', to_jsonb(COALESCE((v_size_data->>'qty_xs')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'S', 'SM', 'ADULT S' THEN v_size_data := jsonb_set(v_size_data, '{qty_s}', to_jsonb(COALESCE((v_size_data->>'qty_s')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'M', 'MD', 'ADULT M' THEN v_size_data := jsonb_set(v_size_data, '{qty_m}', to_jsonb(COALESCE((v_size_data->>'qty_m')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'L', 'LG', 'ADULT L' THEN v_size_data := jsonb_set(v_size_data, '{qty_l}', to_jsonb(COALESCE((v_size_data->>'qty_l')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN 'XL', 'ADULT XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_xl}', to_jsonb(COALESCE((v_size_data->>'qty_xl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN '2XL', '2X', 'XXL', 'ADULT 2XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_2xl}', to_jsonb(COALESCE((v_size_data->>'qty_2xl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN '3XL', '3X', 'XXXL', 'ADULT 3XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_3xl}', to_jsonb(COALESCE((v_size_data->>'qty_3xl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN '4XL', '4X', 'XXXXL', 'ADULT 4XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_4xl}', to_jsonb(COALESCE((v_size_data->>'qty_4xl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              WHEN '5XL', '5X', 'XXXXXL', 'ADULT 5XL' THEN v_size_data := jsonb_set(v_size_data, '{qty_5xl}', to_jsonb(COALESCE((v_size_data->>'qty_5xl')::integer, 0) + COALESCE((v_size->>'qty')::integer, 0)));
              ELSE NULL;
            END CASE;
            
            v_total_qty := v_total_qty + COALESCE((v_size->>'qty')::integer, 0);
          END LOOP;
          
          -- Build description and notes
          v_description := COALESCE(v_product->>'productName', '') || ' - ' || 
            COALESCE(v_product->>'styleName', '') || ' - ' || 
            COALESCE(v_color->>'colorName', '');
          
          v_line_notes := 'Vendor: ' || COALESCE(v_product->>'vendorName', 'N/A') ||
            E'\nStyle: ' || COALESCE(v_product->>'styleName', 'N/A') ||
            E'\nColor: ' || COALESCE(v_color->>'colorName', 'N/A');
          
          IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_line_items (process: %, product: %, color: %)', i, j, k;
          END IF;
          
          -- Create line item - includes garment_unit_price for selling price
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
            garment_unit_price,
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
            v_product->>'styleName',
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
          
          -- Create proof if garment image exists
          IF v_garment_front_image_url IS NOT NULL THEN
            SELECT id INTO v_imprint_id
            FROM quote_imprints
            WHERE quote_id = v_quote_id
            AND group_label = v_group_label
            ORDER BY created_at
            LIMIT 1;
            
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
      
      v_process_counter := v_process_counter + 1;
    END LOOP;
    
    UPDATE chipply_import_logs 
    SET status = 'processed',
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  UPDATE chipply_import_logs 
  SET status = 'error',
      error_message = SQLERRM,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update the standalone function
CREATE OR REPLACE FUNCTION process_chipply_import(log_id uuid)
RETURNS void AS $$
DECLARE
  v_log_record chipply_import_logs%ROWTYPE;
  v_company_id uuid;
  v_payload jsonb;
  v_quote_id uuid;
  v_quote_number text;
  v_next_number integer;
  v_prefix text;
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
  v_imprint_location text;
  v_size_elem jsonb;
  v_size_name text;
  v_size_qty integer;
  v_imprint_rec RECORD;
  i integer;
  j integer;
  k integer;
  m integer;
BEGIN
  SELECT * INTO v_log_record
  FROM chipply_import_logs
  WHERE id = log_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import log not found: %', log_id;
  END IF;
  
  v_company_id := v_log_record.company_id;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is NULL in chipply_import_logs for log_id: %', log_id;
  END IF;
  
  RAISE NOTICE 'Processing import for company_id: %', v_company_id;
  
  IF v_log_record.status = 'processed' THEN
    RAISE NOTICE 'Import log % already processed, skipping', log_id;
    RETURN;
  END IF;
  
  v_payload := v_log_record.raw_json;
  
  IF jsonb_typeof(v_payload) = 'array' THEN
    v_payload := v_payload->0;
  END IF;
  
  v_account_summary := v_payload->'accountSummary';
  v_org_address := v_payload->'organizationAddress';
  v_org_contact_name := v_payload->'organizationPrimaryContactName';
  v_work_order_data := v_payload->'workOrderData';
  
  v_customer_email := v_account_summary->>'contactEmail';
  v_customer_phone := v_account_summary->>'contactPhone';
  v_customer_name := v_account_summary->>'customerName';
  v_customer_company := v_org_address->>'companyName';
  v_customer_first_name := v_org_contact_name->>'firstName';
  v_customer_last_name := v_org_contact_name->>'lastName';
  v_due_date := (v_account_summary->>'dueDate')::date;
  v_sale_order_id := v_account_summary->>'saleOrder';
  
  v_store_name := v_account_summary->>'parentStoreName';
  v_batch_id := v_account_summary->>'batchId';
  
  BEGIN
    v_batch_date := (v_account_summary->>'batchDate')::date;
  EXCEPTION WHEN OTHERS THEN
    v_batch_date := NULL;
  END;
  
  IF v_customer_first_name IS NOT NULL AND v_customer_last_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_first_name || ' ' || v_customer_last_name;
  ELSIF v_customer_first_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_first_name;
  ELSIF v_customer_last_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_last_name;
  ELSE
    v_customer_contact_name := v_customer_name;
  END IF;
  
  IF v_customer_company IS NULL OR v_customer_company = '' THEN
    v_customer_company := COALESCE(v_customer_name, 'Chipply Customer');
  END IF;
  
  -- Build nickname
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
  
  -- Check for duplicate sale order
  IF v_sale_order_id IS NOT NULL THEN
    SELECT id INTO v_existing_quote_id
    FROM quotes
    WHERE company_id = v_company_id
    AND chipply_sale_order_id = v_sale_order_id
    LIMIT 1;
    
    IF v_existing_quote_id IS NOT NULL THEN
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
  
  -- Find or create customer
  IF v_customer_email IS NOT NULL THEN
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
  
  v_notes := 'Chipply Sale Order: ' || COALESCE(v_sale_order_id, 'N/A') ||
    E'\nStore: ' || COALESCE(v_account_summary->>'parentStoreName', 'N/A') ||
    E'\nBatch: ' || COALESCE(v_account_summary->>'batchId', 'N/A');
  
  -- Use MAX-based quote number generation
  SELECT COALESCE(quote_prefix, 'QTE') INTO v_prefix
  FROM company_settings
  WHERE id = v_company_id;
  
  IF v_prefix IS NULL THEN
    v_prefix := 'QTE';
  END IF;
  
  -- Add dash if not present
  IF RIGHT(v_prefix, 1) != '-' THEN
    v_prefix := v_prefix || '-';
  END IF;
  
  -- Find the max existing quote number and increment
  SELECT COALESCE(MAX(
    CASE 
      WHEN quote_number ~ ('^' || REPLACE(v_prefix, '-', '') || '-?[0-9]+$')
      THEN CAST(REGEXP_REPLACE(quote_number, '^[^0-9]*', '') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO v_next_number
  FROM quotes
  WHERE company_id = v_company_id;
  
  v_quote_number := v_prefix || LPAD(v_next_number::text, 4, '0');
  
  RAISE NOTICE 'Generated quote number: % (next_number: %)', v_quote_number, v_next_number;
  
  -- Create the quote
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
  
  -- Process the work order data
  v_processes := v_work_order_data->'processes';
  
  FOR i IN 0..(jsonb_array_length(v_processes) - 1) LOOP
    v_process := v_processes->i;
    v_process_name := v_process->>'processName';
    
    v_group_label := 'Process ' || (i + 1)::text || ': ' || COALESCE(v_process_name, 'Unnamed Process');
    
    RAISE NOTICE 'Processing group: %', v_group_label;
    
    -- Process components (decorations)
    v_components := v_process->'components';
    
    IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' AND jsonb_array_length(v_components) > 0 THEN
      FOR m IN 0..(jsonb_array_length(v_components) - 1) LOOP
        v_component := v_components->m;
        
        v_artwork_variations := v_component->'artworkVariations';
        v_artwork_images := '[]'::jsonb;
        v_artwork_url := NULL;
        
        IF v_artwork_variations IS NOT NULL AND jsonb_typeof(v_artwork_variations) = 'array' AND jsonb_array_length(v_artwork_variations) > 0 THEN
          SELECT jsonb_agg(variation->>'imageSrc')
          INTO v_artwork_images
          FROM jsonb_array_elements(v_artwork_variations) AS variation
          WHERE variation->>'imageSrc' IS NOT NULL;
          
          v_artwork_url := v_artwork_variations->0->>'imageSrc';
        END IF;
        
        IF v_company_id IS NULL THEN
          RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_imprints';
        END IF;
        
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
    
    -- Process products
    v_products := v_process->'products';
    
    FOR j IN 0..(jsonb_array_length(v_products) - 1) LOOP
      v_product := v_products->j;
      
      v_colors := v_product->'productColors';
      
      FOR k IN 0..(jsonb_array_length(v_colors) - 1) LOOP
        v_color := v_colors->k;
        
        v_garment_front_image_url := v_color->>'image1Url';
        v_garment_back_image_url := v_color->>'image2Url';
        v_garment_side_image_url := v_color->>'image3Url';
        
        v_total_qty := 0;
        
        v_size_data := jsonb_build_object(
          'qty_yxs', 0, 'qty_ys', 0, 'qty_ym', 0, 'qty_yl', 0, 'qty_yxl', 0,
          'qty_xs', 0, 'qty_s', 0, 'qty_m', 0, 'qty_l', 0, 'qty_xl', 0,
          'qty_2xl', 0, 'qty_3xl', 0, 'qty_4xl', 0, 'qty_5xl', 0
        );
        
        FOR v_size_elem IN SELECT * FROM jsonb_array_elements(v_color->'sizes')
        LOOP
          v_size_name := UPPER(TRIM(v_size_elem->>'size'));
          v_size_qty := (v_size_elem->>'qty')::integer;
          v_total_qty := v_total_qty + v_size_qty;
          
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
        
        v_description := COALESCE(v_product->>'productName', '') || ' - ' || 
          COALESCE(v_product->>'styleName', '') || ' - ' || 
          COALESCE(v_color->>'colorName', '');
        
        v_line_notes := 'Vendor: ' || COALESCE(v_product->>'vendorName', 'N/A') ||
          E'\nStyle: ' || COALESCE(v_product->>'styleNumber', 'N/A') ||
          E'\nColor: ' || COALESCE(v_color->>'colorName', 'N/A');
        
        IF v_company_id IS NULL THEN
          RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_line_items (process: %, product: %, color: %)', i, j, k;
        END IF;
        
        -- Create line item - includes garment_unit_price for selling price
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
          garment_unit_price,
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
          v_product->>'styleName',
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
        
        -- Create proof if garment image exists
        IF v_garment_front_image_url IS NOT NULL THEN
          SELECT id INTO v_imprint_id
          FROM quote_imprints
          WHERE quote_id = v_quote_id
          AND group_label = v_group_label
          ORDER BY created_at
          LIMIT 1;
          
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
    
    -- Collect ALL garment images for this group first
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
    
    -- Update each imprint with FILTERED garment images based on location
    IF v_garment_images_array IS NOT NULL THEN
      FOR v_imprint_rec IN 
        SELECT id, location 
        FROM quote_imprints 
        WHERE quote_id = v_quote_id 
        AND group_label = v_group_label
      LOOP
        UPDATE quote_imprints
        SET garment_images = get_relevant_garment_images_for_location(
          v_imprint_rec.location, 
          v_garment_images_array
        )
        WHERE id = v_imprint_rec.id;
        
        RAISE NOTICE 'Updated imprint % (location: %) with filtered garment images', 
          v_imprint_rec.id, v_imprint_rec.location;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Update quote totals
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
  UPDATE chipply_import_logs
  SET 
    status = 'failed',
    error_message = SQLERRM,
    updated_at = now()
  WHERE id = log_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
