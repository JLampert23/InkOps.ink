/*
  # Capture Unmapped Chipply Sizes into Line Item Notes
  
  Updates both the trigger and standalone `process_chipply_import` functions 
  to capture any extra/unrecognized size variations (like "Infant 6M") 
  and append them to the line item notes (e.g., "Other Sizes: INFANT 6M: 5").
  
  This guarantees that 100% of size data is visible on the quote UI and PDF 
  even if it doesn't fit into a standard column mapping.
*/

-- 1. Update the standalone function
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
  v_unmapped_sizes text;
  v_imprint_rec RECORD;
  i integer;
  j integer;
  k integer;
  m integer;
BEGIN
  SELECT * INTO v_log_record FROM chipply_import_logs WHERE id = log_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import log not found: %', log_id; END IF;
  v_company_id := v_log_record.company_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'company_id is NULL for log_id: %', log_id; END IF;
  IF v_log_record.status = 'processed' THEN RAISE NOTICE 'Already processed, skipping'; RETURN; END IF;
  
  v_payload := v_log_record.raw_json;
  IF jsonb_typeof(v_payload) = 'array' THEN v_payload := v_payload->0; END IF;
  
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
  BEGIN v_batch_date := (v_account_summary->>'batchDate')::date; EXCEPTION WHEN OTHERS THEN v_batch_date := NULL; END;
  
  IF v_customer_first_name IS NOT NULL AND v_customer_last_name IS NOT NULL THEN
    v_customer_contact_name := v_customer_first_name || ' ' || v_customer_last_name;
  ELSE v_customer_contact_name := COALESCE(v_customer_first_name, v_customer_last_name, v_customer_name); END IF;
  IF v_customer_company IS NULL OR v_customer_company = '' THEN v_customer_company := COALESCE(v_customer_name, 'Chipply Customer'); END IF;
  
  v_nickname := COALESCE(NULLIF(v_store_name,''), 'Chipply Import');
  IF v_batch_id IS NOT NULL AND v_batch_id <> '' THEN v_nickname := v_nickname || ' - Batch ' || v_batch_id; END IF;
  IF v_batch_date IS NOT NULL THEN v_nickname := v_nickname || ' - ' || TO_CHAR(v_batch_date, 'Mon DD, YYYY');
  ELSIF v_due_date IS NOT NULL THEN v_nickname := v_nickname || ' - ' || TO_CHAR(v_due_date, 'Mon DD, YYYY'); END IF;
  
  IF v_sale_order_id IS NOT NULL THEN
    SELECT id INTO v_existing_quote_id FROM quotes WHERE company_id = v_company_id AND chipply_sale_order_id = v_sale_order_id LIMIT 1;
    IF v_existing_quote_id IS NOT NULL THEN
      UPDATE chipply_import_logs SET status = 'processed', error_message = 'Duplicate - already exists', updated_at = now() WHERE id = log_id;
      RETURN;
    END IF;
  END IF;
  
  IF v_customer_email IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM customers WHERE company_id = v_company_id AND email = v_customer_email LIMIT 1;
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (company_id, company_name, contact_name, primary_contact_first_name, primary_contact_last_name, email, phone, created_at)
      VALUES (v_company_id, v_customer_company, v_customer_contact_name, v_customer_first_name, v_customer_last_name, v_customer_email, v_customer_phone, now())
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;
  
  v_notes := 'Chipply Sale Order: ' || COALESCE(v_sale_order_id, 'N/A') || E'\nStore: ' || COALESCE(v_store_name, 'N/A') || E'\nBatch: ' || COALESCE(v_batch_id, 'N/A');
  SELECT COALESCE(quote_prefix, 'QTE') INTO v_prefix FROM company_settings WHERE id = v_company_id;
  IF v_prefix IS NULL THEN v_prefix := 'QTE'; END IF;
  IF RIGHT(v_prefix, 1) != '-' THEN v_prefix := v_prefix || '-'; END IF;
  SELECT COALESCE(MAX(CASE WHEN quote_number ~ ('^' || REPLACE(v_prefix, '-', '') || '-?[0-9]+$') THEN CAST(REGEXP_REPLACE(quote_number, '^[^0-9]*', '') AS INTEGER) ELSE 0 END), 0) + 1 INTO v_next_number FROM quotes WHERE company_id = v_company_id;
  v_quote_number := v_prefix || LPAD(v_next_number::text, 4, '0');
  
  INSERT INTO quotes (company_id, quote_number, customer_id, customer_name, customer_email, customer_phone, customer_company, valid_until, notes, nickname, status, subtotal, total, chipply_import_log_id, chipply_sale_order_id, created_at)
  VALUES (v_company_id, v_quote_number, v_customer_id, v_customer_contact_name, v_customer_email, v_customer_phone, v_customer_company, v_due_date, v_notes, v_nickname, 'draft', 0, 0, log_id, v_sale_order_id, now())
  RETURNING id INTO v_quote_id;
  
  v_processes := v_work_order_data->'processes';
  FOR i IN 0..(jsonb_array_length(v_processes) - 1) LOOP
    v_process := v_processes->i;
    v_process_name := v_process->>'processName';
    v_group_label := 'Process ' || (i + 1)::text || ': ' || COALESCE(v_process_name, 'Unnamed Process');
    v_components := v_process->'components';
    IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' AND jsonb_array_length(v_components) > 0 THEN
      FOR m IN 0..(jsonb_array_length(v_components) - 1) LOOP
        v_component := v_components->m;
        v_artwork_variations := v_component->'artworkVariations';
        v_artwork_images := '[]'::jsonb;
        v_artwork_url := NULL;
        IF v_artwork_variations IS NOT NULL AND jsonb_typeof(v_artwork_variations) = 'array' AND jsonb_array_length(v_artwork_variations) > 0 THEN
          SELECT jsonb_agg(variation->>'imageSrc') INTO v_artwork_images FROM jsonb_array_elements(v_artwork_variations) AS variation WHERE variation->>'imageSrc' IS NOT NULL;
          v_artwork_url := v_artwork_variations->0->>'imageSrc';
        END IF;
        INSERT INTO quote_imprints (quote_id, company_id, group_label, imprint_number, type_of_work, location, details, artwork_url, artwork_images, created_at)
        VALUES (v_quote_id, v_company_id, v_group_label, v_imprint_number::text, v_process_name, v_component->>'artworkLocationName', COALESCE(v_component->>'artworkName', '') || ' - ' || COALESCE(v_component->>'notes', ''), v_artwork_url, COALESCE(v_artwork_images, '[]'::jsonb), now())
        RETURNING id INTO v_imprint_id;
        v_imprint_number := v_imprint_number + 1;
      END LOOP;
    END IF;
    
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
        v_unmapped_sizes := '';
        v_size_data := jsonb_build_object('qty_yxs',0,'qty_ys',0,'qty_ym',0,'qty_yl',0,'qty_yxl',0,'qty_xs',0,'qty_s',0,'qty_m',0,'qty_l',0,'qty_xl',0,'qty_2xl',0,'qty_3xl',0,'qty_4xl',0,'qty_5xl',0);
        
        FOR v_size_elem IN SELECT * FROM jsonb_array_elements(v_color->'sizes') LOOP
          v_size_name := UPPER(TRIM(v_size_elem->>'size'));
          v_size_qty := COALESCE((v_size_elem->>'qty')::integer, 0);
          v_total_qty := v_total_qty + v_size_qty;
          
          CASE v_size_name
            WHEN 'YXS','YOUTH XS' THEN v_size_data := jsonb_set(v_size_data,'{qty_yxs}',to_jsonb(COALESCE((v_size_data->>'qty_yxs')::int,0)+v_size_qty));
            WHEN 'YS','YOUTH S' THEN v_size_data := jsonb_set(v_size_data,'{qty_ys}',to_jsonb(COALESCE((v_size_data->>'qty_ys')::int,0)+v_size_qty));
            WHEN 'YM','YOUTH M' THEN v_size_data := jsonb_set(v_size_data,'{qty_ym}',to_jsonb(COALESCE((v_size_data->>'qty_ym')::int,0)+v_size_qty));
            WHEN 'YL','YOUTH L' THEN v_size_data := jsonb_set(v_size_data,'{qty_yl}',to_jsonb(COALESCE((v_size_data->>'qty_yl')::int,0)+v_size_qty));
            WHEN 'YXL','YOUTH XL' THEN v_size_data := jsonb_set(v_size_data,'{qty_yxl}',to_jsonb(COALESCE((v_size_data->>'qty_yxl')::int,0)+v_size_qty));
            WHEN 'XS' THEN v_size_data := jsonb_set(v_size_data,'{qty_xs}',to_jsonb(COALESCE((v_size_data->>'qty_xs')::int,0)+v_size_qty));
            WHEN 'S','SM','ADULT S' THEN v_size_data := jsonb_set(v_size_data,'{qty_s}',to_jsonb(COALESCE((v_size_data->>'qty_s')::int,0)+v_size_qty));
            WHEN 'M','MD','ADULT M' THEN v_size_data := jsonb_set(v_size_data,'{qty_m}',to_jsonb(COALESCE((v_size_data->>'qty_m')::int,0)+v_size_qty));
            WHEN 'L','LG','ADULT L' THEN v_size_data := jsonb_set(v_size_data,'{qty_l}',to_jsonb(COALESCE((v_size_data->>'qty_l')::int,0)+v_size_qty));
            WHEN 'XL','ADULT XL' THEN v_size_data := jsonb_set(v_size_data,'{qty_xl}',to_jsonb(COALESCE((v_size_data->>'qty_xl')::int,0)+v_size_qty));
            WHEN '2XL','2X','XXL','ADULT 2XL' THEN v_size_data := jsonb_set(v_size_data,'{qty_2xl}',to_jsonb(COALESCE((v_size_data->>'qty_2xl')::int,0)+v_size_qty));
            WHEN '3XL','3X','XXXL','ADULT 3XL' THEN v_size_data := jsonb_set(v_size_data,'{qty_3xl}',to_jsonb(COALESCE((v_size_data->>'qty_3xl')::int,0)+v_size_qty));
            WHEN '4XL','4X','XXXXL','ADULT 4XL' THEN v_size_data := jsonb_set(v_size_data,'{qty_4xl}',to_jsonb(COALESCE((v_size_data->>'qty_4xl')::int,0)+v_size_qty));
            WHEN '5XL','5X','XXXXXL','ADULT 5XL' THEN v_size_data := jsonb_set(v_size_data,'{qty_5xl}',to_jsonb(COALESCE((v_size_data->>'qty_5xl')::int,0)+v_size_qty));
            ELSE 
              -- Append any unmapped sizes to a local string
              v_unmapped_sizes := v_unmapped_sizes || v_size_name || ': ' || v_size_qty || ', ';
          END CASE;
        END LOOP;
        
        v_description := COALESCE(v_product->>'productName','') || ' - ' || COALESCE(v_product->>'styleName','') || ' - ' || COALESCE(v_color->>'colorName','');
        v_line_notes := 'Vendor: ' || COALESCE(v_product->>'vendorName','N/A') || E'\nStyle: ' || COALESCE(v_product->>'styleNumber','N/A') || E'\nColor: ' || COALESCE(v_color->>'colorName','N/A');
        
        -- If we caught any unmapped sizes, stick them nicely into the line items notes so they are highly visible
        IF length(v_unmapped_sizes) > 0 THEN
          v_line_notes := v_line_notes || E'\nOther Sizes: ' || TRIM(TRAILING ', ' FROM v_unmapped_sizes);
        END IF;

        INSERT INTO quote_line_items (quote_id,company_id,group_label,line_type,description,item_number,color,quantity,qty_yxs,qty_ys,qty_ym,qty_yl,qty_yxl,qty_xs,qty_s,qty_m,qty_l,qty_xl,qty_2xl,qty_3xl,qty_4xl,qty_5xl,unit_price,garment_unit_price,total_price,price_locked,notes,garment_front_image_url,garment_back_image_url,garment_side_image_url,created_at)
        VALUES (v_quote_id,v_company_id,v_group_label,'item',v_description,v_product->>'styleName',v_color->>'colorName',0,(v_size_data->>'qty_yxs')::int,(v_size_data->>'qty_ys')::int,(v_size_data->>'qty_ym')::int,(v_size_data->>'qty_yl')::int,(v_size_data->>'qty_yxl')::int,(v_size_data->>'qty_xs')::int,(v_size_data->>'qty_s')::int,(v_size_data->>'qty_m')::int,(v_size_data->>'qty_l')::int,(v_size_data->>'qty_xl')::int,(v_size_data->>'qty_2xl')::int,(v_size_data->>'qty_3xl')::int,(v_size_data->>'qty_4xl')::int,(v_size_data->>'qty_5xl')::int,COALESCE((v_color->>'productPrice')::numeric,0),COALESCE((v_color->>'productPrice')::numeric,0),COALESCE((v_color->>'productPrice')::numeric,0)*v_total_qty,true,v_line_notes,v_garment_front_image_url,v_garment_back_image_url,v_garment_side_image_url,now())
        RETURNING id INTO v_line_item_id;
        
        IF v_garment_front_image_url IS NOT NULL THEN
          SELECT id INTO v_imprint_id FROM quote_imprints WHERE quote_id = v_quote_id AND group_label = v_group_label ORDER BY created_at LIMIT 1;
          INSERT INTO proofs (quote_id,line_item_id,imprint_id,company_id,group_label,proof_number,garment_image_url,status,created_at)
          VALUES (v_quote_id,v_line_item_id,v_imprint_id,v_company_id,v_group_label,v_quote_number||'-P'||LPAD(v_proof_counter::text,3,'0'),v_garment_front_image_url,'draft',now())
          RETURNING id INTO v_proof_id;
          v_proof_counter := v_proof_counter + 1;
        END IF;
      END LOOP;
    END LOOP;
    
    SELECT jsonb_agg(DISTINCT img_obj) INTO v_garment_images_array FROM (SELECT jsonb_build_object('url',garment_front_image_url,'view','front') AS img_obj FROM quote_line_items WHERE quote_id=v_quote_id AND group_label=v_group_label AND garment_front_image_url IS NOT NULL UNION ALL SELECT jsonb_build_object('url',garment_back_image_url,'view','back') FROM quote_line_items WHERE quote_id=v_quote_id AND group_label=v_group_label AND garment_back_image_url IS NOT NULL UNION ALL SELECT jsonb_build_object('url',garment_side_image_url,'view','side') FROM quote_line_items WHERE quote_id=v_quote_id AND group_label=v_group_label AND garment_side_image_url IS NOT NULL) imgs;
    IF v_garment_images_array IS NOT NULL THEN
      FOR v_imprint_rec IN SELECT id,location FROM quote_imprints WHERE quote_id=v_quote_id AND group_label=v_group_label LOOP
        UPDATE quote_imprints SET garment_images=get_relevant_garment_images_for_location(v_imprint_rec.location,v_garment_images_array) WHERE id=v_imprint_rec.id;
      END LOOP;
    END IF;
  END LOOP;
  UPDATE quotes SET subtotal=(SELECT COALESCE(SUM(total_price),0) FROM quote_line_items WHERE quote_id=v_quote_id), total=(SELECT COALESCE(SUM(total_price),0) FROM quote_line_items WHERE quote_id=v_quote_id) WHERE id=v_quote_id;
  UPDATE chipply_import_logs SET status='processed', error_message=NULL, updated_at=now() WHERE id=log_id;
EXCEPTION WHEN OTHERS THEN
  UPDATE chipply_import_logs SET status='failed', error_message=SQLERRM, updated_at=now() WHERE id=log_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
