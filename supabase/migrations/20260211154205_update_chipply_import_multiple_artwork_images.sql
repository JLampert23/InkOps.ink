/*
  # Update Chipply Import to Capture All Artwork Variations

  1. Changes
    - Extract all artwork variations from Chipply components
    - Store them in the artwork_images array
    - Keep the first one in artwork_url for backward compatibility
*/

CREATE OR REPLACE FUNCTION process_chipply_import(log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_due_date date;
  v_notes text;
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_proof_id uuid;
  v_imprint_number integer := 1;
  v_proof_counter integer := 1;
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
  v_artwork_images jsonb;
  v_variation jsonb;
  v_processes_count integer;
  v_products_count integer;
  v_colors_count integer;
  v_components_count integer;
  v_variations_count integer;
  v_desc text;
  v_vendor_name text;
  v_product_cost text;
  v_product_name text;
  v_style_name text;
  v_color_name text;
  v_product_price numeric;
  v_process_name text;
  v_process_desc text;
  v_artwork_name text;
  v_comp_qty integer;
  v_comp_price numeric;
  v_type_code text;
  v_location_name text;
  v_comp_notes text;
  v_group_label text;
  v_image1_url text;
  v_image2_url text;
  v_image3_url text;
  v_proof_number text;
  v_youth_sizes jsonb;
  v_adult_sizes jsonb;
  v_regular_sizes jsonb;
  v_size_mode text;
  v_size_name text;
  v_size_qty integer;
  v_store_name text;
  v_batch_id text;
  v_sale_order text;
  v_nickname text;
  v_bill_address_1 text;
  v_bill_address_2 text;
  v_bill_city text;
  v_bill_state text;
  v_bill_zip text;
  -- Individual size quantities
  v_qty_yxs integer := 0;
  v_qty_ys integer := 0;
  v_qty_ym integer := 0;
  v_qty_yl integer := 0;
  v_qty_yxl integer := 0;
  v_qty_xs integer := 0;
  v_qty_s integer := 0;
  v_qty_m integer := 0;
  v_qty_l integer := 0;
  v_qty_xl integer := 0;
  v_qty_2xl integer := 0;
  v_qty_3xl integer := 0;
  v_qty_4xl integer := 0;
  v_qty_5xl integer := 0;
  v_qty_sm integer := 0;
  v_qty_lxl integer := 0;
  v_qty_ysym integer := 0;
  v_qty_ylyxl integer := 0;
  i integer;
  j integer;
  k integer;
  m integer;
  s integer;
  v integer;
BEGIN
  SELECT * INTO v_log_record
  FROM chipply_import_logs
  WHERE id = log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import log not found: %', log_id;
  END IF;

  v_company_id := v_log_record.company_id;
  v_payload := v_log_record.raw_json;

  IF jsonb_typeof(v_payload) = 'array' THEN
    v_payload := v_payload->0;
  END IF;

  v_account_summary := v_payload->'accountSummary';
  v_work_order_data := v_payload->'workOrderData';

  IF v_work_order_data IS NULL THEN
    RAISE EXCEPTION 'No workOrderData found in payload';
  END IF;

  -- Extract customer details
  v_customer_name := v_account_summary->>'customerName';
  v_customer_email := v_account_summary->>'customerEmail';
  v_customer_phone := v_account_summary->>'customerPhone';
  v_due_date := (v_account_summary->>'dueDate')::date;
  v_store_name := COALESCE(v_account_summary->>'parentStoreName', '');
  v_batch_id := COALESCE(v_account_summary->>'batchId', '');
  v_sale_order := COALESCE(v_account_summary->>'saleOrder', '');

  -- Extract billing address if available
  v_bill_address_1 := v_account_summary->>'customerAddress1';
  v_bill_address_2 := v_account_summary->>'customerAddress2';
  v_bill_city := v_account_summary->>'customerCity';
  v_bill_state := v_account_summary->>'customerState';
  v_bill_zip := v_account_summary->>'customerZip';

  -- Build nickname from store name, batch ID, and date
  v_nickname := '';
  IF v_store_name != '' THEN
    v_nickname := v_store_name;
  END IF;
  IF v_batch_id != '' THEN
    v_nickname := v_nickname || CASE WHEN v_nickname != '' THEN ' | Batch: ' ELSE 'Batch: ' END || v_batch_id;
  END IF;
  IF v_due_date IS NOT NULL THEN
    v_nickname := v_nickname || CASE WHEN v_nickname != '' THEN ' | ' ELSE '' END || TO_CHAR(v_due_date, 'MM/DD/YYYY');
  END IF;

  v_notes := 'Chipply Sale Order: ' || COALESCE(v_sale_order, 'N/A')
    || E'\nStore: ' || COALESCE(v_store_name, 'N/A')
    || E'\nBatch: ' || COALESCE(v_batch_id, 'N/A');

  SELECT
    COALESCE(quote_prefix, 'QTE') || '-' || LPAD((COALESCE(quote_start_number, 1))::text, 4, '0'),
    COALESCE(quote_start_number, 1)
  INTO v_quote_number, v_next_number
  FROM company_settings
  WHERE id = v_company_id;

  IF v_quote_number IS NULL THEN
    v_quote_number := 'QTE-' || LPAD('1', 4, '0');
    v_next_number := 1;
  END IF;

  INSERT INTO quotes (
    company_id, quote_number, customer_name, customer_email, customer_phone,
    bill_name, bill_company, 
    bill_address_1, bill_address_2, bill_city, bill_state, bill_zip,
    valid_until, nickname, notes, status, subtotal, total, 
    chipply_import_log_id, created_at
  ) VALUES (
    v_company_id, v_quote_number, v_customer_name, v_customer_email, v_customer_phone,
    v_customer_name, v_customer_name,
    v_bill_address_1, v_bill_address_2, v_bill_city, v_bill_state, v_bill_zip,
    v_due_date, v_nickname, v_notes, 'draft', 0, 0, 
    log_id, now()
  )
  RETURNING id INTO v_quote_id;

  UPDATE company_settings
  SET quote_start_number = v_next_number + 1
  WHERE id = v_company_id;

  v_processes := v_work_order_data->'processes';

  IF v_processes IS NULL OR jsonb_typeof(v_processes) != 'array' THEN
    RAISE EXCEPTION 'No processes array found in workOrderData';
  END IF;

  v_processes_count := jsonb_array_length(v_processes);

  IF v_processes_count IS NULL OR v_processes_count = 0 THEN
    RAISE EXCEPTION 'Processes array is empty';
  END IF;

  FOR i IN 0..(v_processes_count - 1) LOOP
    v_process := v_processes->i;
    v_process_name := v_process->>'processName';
    v_process_desc := v_process->>'processDescription';
    
    v_group_label := 'Process ' || (i + 1)::text || ': ' || COALESCE(v_process_name, 'Unnamed');

    v_components := v_process->'components';

    IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' THEN
      v_components_count := jsonb_array_length(v_components);

      IF v_components_count > 0 THEN
        FOR m IN 0..(v_components_count - 1) LOOP
          v_component := v_components->m;
          
          -- Extract ALL artwork variations, not just the first one
          v_artwork_url := NULL;
          v_artwork_images := '[]'::jsonb;
          BEGIN
            v_artwork_variations := v_component->'artworkVariations';
            IF v_artwork_variations IS NOT NULL AND jsonb_typeof(v_artwork_variations) = 'array' THEN
              v_variations_count := jsonb_array_length(v_artwork_variations);
              IF v_variations_count > 0 THEN
                -- Get the first one for backward compatibility
                v_first_variation := v_artwork_variations->0;
                IF v_first_variation IS NOT NULL THEN
                  v_artwork_url := v_first_variation->>'imageSrc';
                END IF;
                
                -- Extract all artwork variation image URLs
                FOR v IN 0..(v_variations_count - 1) LOOP
                  v_variation := v_artwork_variations->v;
                  IF v_variation IS NOT NULL AND v_variation->>'imageSrc' IS NOT NULL THEN
                    v_artwork_images := v_artwork_images || jsonb_build_array(v_variation->>'imageSrc');
                  END IF;
                END LOOP;
              END IF;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_artwork_url := NULL;
            v_artwork_images := '[]'::jsonb;
          END;

          v_artwork_name := COALESCE(v_component->>'artworkName', 'Unknown');
          v_type_code := v_component->>'typeCode';
          v_location_name := COALESCE(v_component->>'artworkLocationName', '');
          v_comp_notes := COALESCE(v_component->>'notes', '');

          INSERT INTO quote_imprints (
            quote_id, company_id, imprint_number,
            type_of_work, details, artwork_url, artwork_images,
            location, group_label, created_at
          ) VALUES (
            v_quote_id, v_company_id, v_imprint_number::text,
            v_artwork_name, v_comp_notes, v_artwork_url, v_artwork_images,
            v_location_name, v_group_label, now()
          )
          RETURNING id INTO v_imprint_id;

          v_imprint_number := v_imprint_number + 1;
        END LOOP;
      END IF;
    END IF;

    v_products := v_process->'products';

    IF v_products IS NOT NULL AND jsonb_typeof(v_products) = 'array' THEN
      v_products_count := jsonb_array_length(v_products);

      IF v_products_count > 0 THEN
        FOR j IN 0..(v_products_count - 1) LOOP
          v_product := v_products->j;
          v_product_name := v_product->>'productName';
          v_style_name := v_product->>'styleName';
          v_vendor_name := COALESCE(v_product->>'vendorName', 'N/A');

          v_colors := v_product->'productColors';

          IF v_colors IS NOT NULL AND jsonb_typeof(v_colors) = 'array' THEN
            v_colors_count := jsonb_array_length(v_colors);

            IF v_colors_count > 0 THEN
              FOR k IN 0..(v_colors_count - 1) LOOP
                v_color := v_colors->k;
                v_color_name := v_color->>'colorName';
                v_product_cost := COALESCE(v_color->>'productCost', '0');
                v_product_price := COALESCE((v_color->>'productPrice')::numeric, 0);
                
                v_image1_url := v_color->>'image1Url';
                v_image2_url := v_color->>'image2Url';
                v_image3_url := v_color->>'image3Url';

                -- Reset all size quantities
                v_qty_yxs := 0;
                v_qty_ys := 0;
                v_qty_ym := 0;
                v_qty_yl := 0;
                v_qty_yxl := 0;
                v_qty_xs := 0;
                v_qty_s := 0;
                v_qty_m := 0;
                v_qty_l := 0;
                v_qty_xl := 0;
                v_qty_2xl := 0;
                v_qty_3xl := 0;
                v_qty_4xl := 0;
                v_qty_5xl := 0;
                v_qty_sm := 0;
                v_qty_lxl := 0;
                v_qty_ysym := 0;
                v_qty_ylyxl := 0;
                v_total_qty := 0;
                v_size_mode := 'adult';

                -- Parse sizes and map to individual columns
                IF v_color->'sizes' IS NOT NULL AND jsonb_typeof(v_color->'sizes') = 'array' THEN
                  FOR s IN 0..(jsonb_array_length(v_color->'sizes') - 1) LOOP
                    v_size_name := UPPER((v_color->'sizes'->s)->>'size');
                    v_size_qty := COALESCE(((v_color->'sizes'->s)->>'qty')::integer, 0);
                    v_total_qty := v_total_qty + v_size_qty;

                    -- Map to individual columns based on size name
                    CASE v_size_name
                      -- Youth sizes
                      WHEN 'YXS' THEN v_qty_yxs := v_size_qty;
                      WHEN 'YS' THEN v_qty_ys := v_size_qty;
                      WHEN 'YM' THEN v_qty_ym := v_size_qty;
                      WHEN 'YL' THEN v_qty_yl := v_size_qty;
                      WHEN 'YXL' THEN v_qty_yxl := v_size_qty;
                      -- Adult sizes
                      WHEN 'XS' THEN v_qty_xs := v_size_qty;
                      WHEN 'S' THEN v_qty_s := v_size_qty;
                      WHEN 'M' THEN v_qty_m := v_size_qty;
                      WHEN 'L' THEN v_qty_l := v_size_qty;
                      WHEN 'XL' THEN v_qty_xl := v_size_qty;
                      WHEN '2XL' THEN v_qty_2xl := v_size_qty;
                      WHEN '3XL' THEN v_qty_3xl := v_size_qty;
                      WHEN '4XL' THEN v_qty_4xl := v_size_qty;
                      WHEN '5XL' THEN v_qty_5xl := v_size_qty;
                      -- Double sizes
                      WHEN 'S/M', 'SM' THEN v_qty_sm := v_size_qty;
                      WHEN 'L/XL', 'LXL' THEN v_qty_lxl := v_size_qty;
                      WHEN 'YS/YM', 'YSYM' THEN v_qty_ysym := v_size_qty;
                      WHEN 'YL/YXL', 'YLYXL' THEN v_qty_ylyxl := v_size_qty;
                      ELSE NULL;
                    END CASE;

                    -- Determine size mode
                    IF v_size_name ~ '^Y' THEN
                      v_size_mode := 'youth';
                    ELSIF v_size_name IN ('OS', 'ONE SIZE', 'OSFA') THEN
                      v_size_mode := 'regular';
                    ELSIF v_size_name ~ '/' OR v_size_name IN ('SM', 'LXL', 'YSYM', 'YLYXL') THEN
                      v_size_mode := 'double';
                    END IF;
                  END LOOP;
                END IF;

                v_desc := v_product_name || ' - ' || v_style_name || ' - ' || v_color_name;

                INSERT INTO quote_line_items (
                  quote_id, company_id, description, quantity,
                  unit_price, total_price, group_label,
                  item_number, color, size_mode,
                  qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl,
                  qty_xs, qty_s, qty_m, qty_l, qty_xl,
                  qty_2xl, qty_3xl, qty_4xl, qty_5xl,
                  qty_sm, qty_lxl, qty_ysym, qty_ylyxl,
                  created_at
                ) VALUES (
                  v_quote_id, v_company_id, v_desc, v_total_qty,
                  v_product_price, v_product_price * v_total_qty,
                  v_group_label,
                  v_style_name, v_color_name, v_size_mode,
                  NULLIF(v_qty_yxs, 0), NULLIF(v_qty_ys, 0), NULLIF(v_qty_ym, 0), NULLIF(v_qty_yl, 0), NULLIF(v_qty_yxl, 0),
                  NULLIF(v_qty_xs, 0), NULLIF(v_qty_s, 0), NULLIF(v_qty_m, 0), NULLIF(v_qty_l, 0), NULLIF(v_qty_xl, 0),
                  NULLIF(v_qty_2xl, 0), NULLIF(v_qty_3xl, 0), NULLIF(v_qty_4xl, 0), NULLIF(v_qty_5xl, 0),
                  NULLIF(v_qty_sm, 0), NULLIF(v_qty_lxl, 0), NULLIF(v_qty_ysym, 0), NULLIF(v_qty_ylyxl, 0),
                  now()
                )
                RETURNING id INTO v_line_item_id;
                
                IF v_image1_url IS NOT NULL THEN
                  v_proof_number := v_quote_number || '-P' || LPAD(v_proof_counter::text, 3, '0');
                  
                  INSERT INTO proofs (
                    company_id, quote_id, line_item_id, imprint_id,
                    proof_number, garment_image_url, garment_name,
                    garment_description, garment_brand,
                    type_of_work, group_label, status, created_at
                  ) VALUES (
                    v_company_id, v_quote_id, v_line_item_id, v_imprint_id,
                    v_proof_number, v_image1_url, v_product_name,
                    v_style_name || ' - ' || v_color_name, v_vendor_name,
                    v_process_name, v_group_label, 'draft', now()
                  )
                  RETURNING id INTO v_proof_id;
                  
                  v_proof_counter := v_proof_counter + 1;
                END IF;
              END LOOP;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

  END LOOP;

  UPDATE quotes
  SET
    subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM quote_line_items WHERE quote_id = v_quote_id),
    total = (SELECT COALESCE(SUM(total_price), 0) FROM quote_line_items WHERE quote_id = v_quote_id)
  WHERE id = v_quote_id;

  UPDATE chipply_import_logs
  SET
    status = 'processed',
    error_message = NULL,
    updated_at = now()
  WHERE id = log_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE chipply_import_logs
  SET
    status = 'failed',
    error_message = SQLERRM,
    updated_at = now()
  WHERE id = log_id;

  RAISE;
END;
$$;
