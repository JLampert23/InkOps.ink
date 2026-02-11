/*
  # Fix Image Column Names in Chipply Processor

  1. Changes
    - Correct column names: garment_rear_image_url, garment_side_image_url
    - Was incorrectly using: garment_image_rear_url, garment_image_side_url
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
  v_imprint_id uuid;
  v_line_item_id uuid;
  v_imprint_number integer := 1;
  v_line_number integer := 1;
  v_account_summary jsonb;
  v_work_order_data jsonb;
  v_process jsonb;
  v_product jsonb;
  v_color jsonb;
  v_component jsonb;
  v_processes jsonb;
  v_products jsonb;
  v_colors jsonb;
  v_components jsonb;
  v_size jsonb;
  v_size_name text;
  v_size_qty integer;
  i integer;
  j integer;
  k integer;
  m integer;
  s integer;
  v_processes_length integer;
  v_products_length integer;
  v_colors_length integer;
  v_components_length integer;
  v_sizes_length integer;
  v_total_qty integer;
  v_item_number text;
  v_color_name text;
  v_product_name text;
  v_style_name text;
  v_process_name text;
  v_group_label text;
  v_image_url text;
  v_image_rear_url text;
  v_image_side_url text;
  v_qty_xs integer := 0;
  v_qty_s integer := 0;
  v_qty_m integer := 0;
  v_qty_l integer := 0;
  v_qty_xl integer := 0;
  v_qty_2xl integer := 0;
  v_qty_3xl integer := 0;
  v_qty_4xl integer := 0;
  v_qty_5xl integer := 0;
  v_qty_yxs integer := 0;
  v_qty_ys integer := 0;
  v_qty_ym integer := 0;
  v_qty_yl integer := 0;
  v_qty_yxl integer := 0;
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

  v_customer_name := v_account_summary->>'customerName';
  v_due_date := (v_account_summary->>'dueDate')::date;
  v_notes := 'Chipply Sale Order: ' || COALESCE(v_account_summary->>'saleOrder', 'N/A') ||
             E'\nStore: ' || COALESCE(v_account_summary->>'parentStoreName', 'N/A') ||
             E'\nBatch: ' || COALESCE(v_account_summary->>'batchId', 'N/A');

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

  UPDATE company_settings
  SET quote_start_number = v_next_number + 1
  WHERE id = v_company_id;

  v_processes := COALESCE(v_work_order_data->'processes', '[]'::jsonb);
  v_processes_length := jsonb_array_length(v_processes);

  FOR i IN 0..(v_processes_length - 1) LOOP
    v_process := v_processes->i;
    
    v_process_name := COALESCE(v_process->>'processName', 'Process ' || (i + 1)::text);
    v_group_label := v_process_name;
    
    INSERT INTO quote_imprints (
      quote_id,
      company_id,
      imprint_number,
      type_of_work,
      details,
      group_label,
      created_at
    ) VALUES (
      v_quote_id,
      v_company_id,
      v_imprint_number::text,
      v_process_name,
      COALESCE(v_process->>'processDescription', ''),
      v_group_label,
      now()
    )
    RETURNING id INTO v_imprint_id;

    v_imprint_number := v_imprint_number + 1;

    v_products := COALESCE(v_process->'products', '[]'::jsonb);
    v_products_length := jsonb_array_length(v_products);

    FOR j IN 0..(v_products_length - 1) LOOP
      v_product := v_products->j;
      
      v_product_name := COALESCE(v_product->>'productName', 'Product');
      v_style_name := COALESCE(v_product->>'styleName', '');
      
      v_colors := COALESCE(v_product->'productColors', '[]'::jsonb);
      v_colors_length := jsonb_array_length(v_colors);

      FOR k IN 0..(v_colors_length - 1) LOOP
        v_color := v_colors->k;
        v_color_name := COALESCE(v_color->>'colorName', '');
        
        v_qty_xs := 0; v_qty_s := 0; v_qty_m := 0; v_qty_l := 0; v_qty_xl := 0;
        v_qty_2xl := 0; v_qty_3xl := 0; v_qty_4xl := 0; v_qty_5xl := 0;
        v_qty_yxs := 0; v_qty_ys := 0; v_qty_ym := 0; v_qty_yl := 0; v_qty_yxl := 0;
        v_total_qty := 0;
        v_item_number := NULL;
        
        v_image_url := v_color->>'image1Url';
        v_image_rear_url := v_color->>'image2Url';
        v_image_side_url := v_color->>'image3Url';
        
        v_sizes_length := jsonb_array_length(COALESCE(v_color->'sizes', '[]'::jsonb));
        FOR s IN 0..(v_sizes_length - 1) LOOP
          v_size := (v_color->'sizes')->s;
          v_size_name := UPPER(COALESCE(v_size->>'size', ''));
          v_size_qty := COALESCE((v_size->>'qty')::integer, 0);
          v_total_qty := v_total_qty + v_size_qty;
          
          IF v_item_number IS NULL THEN
            v_item_number := v_size->>'sku';
          END IF;
          
          CASE v_size_name
            WHEN 'XS' THEN v_qty_xs := v_size_qty;
            WHEN 'S' THEN v_qty_s := v_size_qty;
            WHEN 'M' THEN v_qty_m := v_size_qty;
            WHEN 'L' THEN v_qty_l := v_size_qty;
            WHEN 'XL' THEN v_qty_xl := v_size_qty;
            WHEN '2XL', 'XXL' THEN v_qty_2xl := v_size_qty;
            WHEN '3XL', 'XXXL' THEN v_qty_3xl := v_size_qty;
            WHEN '4XL' THEN v_qty_4xl := v_size_qty;
            WHEN '5XL' THEN v_qty_5xl := v_size_qty;
            WHEN 'YXS' THEN v_qty_yxs := v_size_qty;
            WHEN 'YS' THEN v_qty_ys := v_size_qty;
            WHEN 'YM' THEN v_qty_ym := v_size_qty;
            WHEN 'YL' THEN v_qty_yl := v_size_qty;
            WHEN 'YXL' THEN v_qty_yxl := v_size_qty;
            ELSE NULL;
          END CASE;
        END LOOP;

        INSERT INTO quote_line_items (
          quote_id,
          company_id,
          line_number,
          line_type,
          item_number,
          description,
          color,
          quantity,
          qty_xs, qty_s, qty_m, qty_l, qty_xl, qty_2xl, qty_3xl, qty_4xl, qty_5xl,
          qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl,
          unit_price,
          total_price,
          supplier_name,
          group_label,
          garment_image_url,
          garment_rear_image_url,
          garment_side_image_url,
          notes,
          created_at
        ) VALUES (
          v_quote_id,
          v_company_id,
          v_line_number,
          'item',
          v_item_number,
          v_product_name || CASE WHEN v_style_name != '' THEN ' - ' || v_style_name ELSE '' END,
          v_color_name,
          v_total_qty,
          v_qty_xs, v_qty_s, v_qty_m, v_qty_l, v_qty_xl, v_qty_2xl, v_qty_3xl, v_qty_4xl, v_qty_5xl,
          v_qty_yxs, v_qty_ys, v_qty_ym, v_qty_yl, v_qty_yxl,
          COALESCE((v_color->>'productPrice')::numeric, 0),
          COALESCE((v_color->>'productPrice')::numeric, 0) * v_total_qty,
          v_product->>'vendorName',
          v_group_label,
          v_image_url,
          v_image_rear_url,
          v_image_side_url,
          'Cost: $' || COALESCE(v_color->>'productCost', '0'),
          now()
        );
        
        v_line_number := v_line_number + 1;
      END LOOP;
    END LOOP;

    v_components := COALESCE(v_process->'components', '[]'::jsonb);
    v_components_length := jsonb_array_length(v_components);

    FOR m IN 0..(v_components_length - 1) LOOP
      v_component := v_components->m;
      
      INSERT INTO quote_line_items (
        quote_id,
        company_id,
        line_number,
        line_type,
        description,
        quantity,
        unit_price,
        total_price,
        decoration_method,
        decoration_location,
        group_label,
        notes,
        created_at
      ) VALUES (
        v_quote_id,
        v_company_id,
        v_line_number,
        'fee',
        COALESCE(v_component->>'artworkName', 'Decoration'),
        COALESCE((v_component->>'qty')::integer, 0),
        COALESCE((v_component->>'processPrice')::numeric, 0),
        COALESCE((v_component->>'processPrice')::numeric, 0) * 
        COALESCE((v_component->>'qty')::integer, 0),
        v_component->>'typeCode',
        v_component->>'artworkLocationName',
        v_group_label,
        'Process Cost: $' || COALESCE(v_component->>'processCost', '0') ||
        E'\nNotes: ' || COALESCE(v_component->>'notes', ''),
        now()
      );
      
      v_line_number := v_line_number + 1;
    END LOOP;
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
END;
$$ LANGUAGE plpgsql;
