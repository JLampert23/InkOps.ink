/*
  # Fix Chipply Processor Operator Precedence Bug

  1. Changes
    - Rewrites `process_chipply_import` function
    - Adds parentheses around all `->>` expressions used with `||` concatenation
    - The `->>` and `||` operators share the same precedence in PostgreSQL,
      causing `a->>'x' || b->>'y'` to be parsed as `(a->>'x' || b) ->> 'y'`
      which tries to use `->>` on text (invalid)

  2. Important Notes
    - Root cause: PostgreSQL operator precedence treats `||` and `->>` equally
    - Fix: Wrap all `->>'key'` in parentheses when concatenating
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
  v_due_date date;
  v_notes text;
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
  v_processes_count integer;
  v_products_count integer;
  v_colors_count integer;
  v_components_count integer;
  v_desc text;
  v_notes_text text;
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
  i integer;
  j integer;
  k integer;
  m integer;
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

  v_customer_name := v_account_summary->>'customerName';
  v_due_date := (v_account_summary->>'dueDate')::date;

  v_notes := 'Chipply Sale Order: ' || COALESCE(v_account_summary->>'saleOrder', 'N/A')
    || E'\nStore: ' || COALESCE(v_account_summary->>'parentStoreName', 'N/A')
    || E'\nBatch: ' || COALESCE((v_account_summary->>'batchId'), 'N/A');

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
    company_id, quote_number, customer_name, valid_until,
    notes, status, subtotal, total, chipply_import_log_id, created_at
  ) VALUES (
    v_company_id, v_quote_number, v_customer_name, v_due_date,
    v_notes, 'draft', 0, 0, log_id, now()
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

    v_process_name := v_process->>'processName';
    v_process_desc := v_process->>'processDescription';

    INSERT INTO quote_imprints (
      quote_id, company_id, imprint_number,
      type_of_work, details, artwork_url, created_at
    ) VALUES (
      v_quote_id, v_company_id, v_imprint_number::text,
      v_process_name, v_process_desc, v_artwork_url, now()
    )
    RETURNING id INTO v_imprint_id;

    v_imprint_number := v_imprint_number + 1;

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

                SELECT COALESCE(SUM((size_elem->>'qty')::integer), 0)
                INTO v_total_qty
                FROM jsonb_array_elements(COALESCE(v_color->'sizes', '[]'::jsonb)) AS size_elem;

                v_size_data := jsonb_build_object(
                  'sizes', (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'size', size_elem->>'size',
                        'quantity', (size_elem->>'qty')::integer
                      )
                    )
                    FROM jsonb_array_elements(COALESCE(v_color->'sizes', '[]'::jsonb)) AS size_elem
                  )
                );

                v_desc := v_product_name || ' - ' || v_style_name || ' - ' || v_color_name;
                v_notes_text := 'Vendor: ' || v_vendor_name
                  || E'\nCost: $' || v_product_cost
                  || E'\nSizes: ' || COALESCE(v_size_data::text, '{}');

                INSERT INTO quote_line_items (
                  quote_id, company_id, description, quantity,
                  unit_price, total_price, notes, created_at
                ) VALUES (
                  v_quote_id, v_company_id, v_desc, v_total_qty,
                  v_product_price, v_product_price * v_total_qty,
                  v_notes_text, now()
                )
                RETURNING id INTO v_line_item_id;
              END LOOP;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    v_components := v_process->'components';

    IF v_components IS NOT NULL AND jsonb_typeof(v_components) = 'array' THEN
      v_components_count := jsonb_array_length(v_components);

      IF v_components_count > 0 THEN
        FOR m IN 0..(v_components_count - 1) LOOP
          v_component := v_components->m;

          v_artwork_name := COALESCE(v_component->>'artworkName', 'Unknown');
          v_comp_qty := COALESCE((v_component->>'qty')::integer, 0);
          v_comp_price := COALESCE((v_component->>'processPrice')::numeric, 0);
          v_type_code := v_component->>'typeCode';
          v_location_name := COALESCE(v_component->>'artworkLocationName', '');
          v_comp_notes := COALESCE(v_component->>'notes', '');

          INSERT INTO quote_line_items (
            quote_id, company_id, description, quantity,
            unit_price, total_price, decoration_method,
            decoration_location, notes, created_at
          ) VALUES (
            v_quote_id, v_company_id,
            'Decoration: ' || v_artwork_name,
            v_comp_qty, v_comp_price, v_comp_price * v_comp_qty,
            v_type_code, v_location_name,
            'Location: ' || v_location_name || E'\nNotes: ' || v_comp_notes,
            now()
          );
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
