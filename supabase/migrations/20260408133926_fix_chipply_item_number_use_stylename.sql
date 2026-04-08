/*
  # Fix Chipply Import - Map styleName to item_number Column

  ## Summary
  The Chipply import was not populating the Item # column because the code was 
  looking for a field called `styleNumber` which doesn't exist in Chipply's payload.
  Chipply sends the garment style number (e.g., "18500", "3310", "3600") in a field 
  called `styleName` instead.

  ## Changes
  1. Updates the `process_chipply_import()` function to read from `styleName` 
     instead of `styleNumber` when populating the `item_number` column
  2. Also fixes the notes field to show the correct style number instead of "N/A"

  ## Impact
  - Future Chipply imports will correctly populate the Item # field with the 
    garment style number
  - No data loss or breaking changes
*/

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
BEGIN
  IF NEW.status = 'pending' THEN
    v_work_order_data := NEW.raw_json->0->'workOrderData';
    
    IF v_work_order_data IS NULL THEN
      UPDATE chipply_import_logs 
      SET status = 'error', 
          error_message = 'No workOrderData found in payload',
          processed_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;

    v_company_id := NEW.company_id;
    
    IF v_company_id IS NULL THEN
      UPDATE chipply_import_logs 
      SET status = 'error', 
          error_message = 'No company_id found for import',
          processed_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;

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

    v_nickname := COALESCE(
      v_work_order_data->>'eventName',
      'Chipply Import ' || to_char(now(), 'MM/DD/YYYY')
    );

    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'FATAL: company_id is NULL before creating quote';
    END IF;

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
      now()
    )
    RETURNING id INTO v_quote_id;

    FOR i IN 0..jsonb_array_length(v_work_order_data->'processes') - 1 LOOP
      v_process := v_work_order_data->'processes'->i;
      v_group_label := 'Group ' || v_process_counter;

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

      FOR j IN 0..jsonb_array_length(v_process->'products') - 1 LOOP
        v_product := v_process->'products'->j;

        FOR k IN 0..jsonb_array_length(v_product->'productColors') - 1 LOOP
          v_color := v_product->'productColors'->k;

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

          v_size_data := '{"qty_yxs": 0, "qty_ys": 0, "qty_ym": 0, "qty_yl": 0, "qty_yxl": 0, "qty_xs": 0, "qty_s": 0, "qty_m": 0, "qty_l": 0, "qty_xl": 0, "qty_2xl": 0, "qty_3xl": 0, "qty_4xl": 0, "qty_5xl": 0}'::jsonb;
          v_total_qty := 0;

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

          v_description := COALESCE(v_product->>'productName', '') || ' - ' || 
                          COALESCE(v_product->>'styleName', '') || ' - ' || 
                          COALESCE(v_color->>'colorName', '');
          
          v_line_notes := 'Vendor: ' || COALESCE(v_product->>'vendorName', 'N/A') ||
                         E'\nStyle: ' || COALESCE(v_product->>'styleName', 'N/A') ||
                         E'\nColor: ' || COALESCE(v_color->>'colorName', 'N/A');

          IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'FATAL: company_id became NULL before inserting quote_line_items (process: %, product: %, color: %)', i, j, k;
          END IF;

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
            COALESCE((v_color->>'productPrice')::numeric, 0) * v_total_qty,
            v_line_notes,
            v_garment_front_image_url,
            v_garment_back_image_url,
            v_garment_side_image_url,
            now()
          )
          RETURNING id INTO v_line_item_id;

          RAISE NOTICE 'Created line item for group % with % total quantity', v_group_label, v_total_qty;

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
        processed_at = now(),
        quote_id = v_quote_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  UPDATE chipply_import_logs 
  SET status = 'error',
      error_message = SQLERRM,
      processed_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;