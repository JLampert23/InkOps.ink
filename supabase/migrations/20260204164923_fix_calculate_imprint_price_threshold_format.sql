/*
  # Fix calculate_imprint_price to Handle Threshold Format

  ## Problem
  The function only handles range formats like "1-11", "12-23", "99+" but many price matrices
  use threshold formats like "1", "12", "24", "48" (meaning >=1, >=12, >=24, etc).

  ## Solution
  Update the function to handle both formats:
  - Range format: "1-11", "12-23", "99+"
  - Threshold format: "1", "12", "24" (find the highest threshold that qty meets)

  ## Example
  For qty 170 with thresholds ["1", "12", "24", "48", "72", "99", "249"]:
  - 170 >= 99 but < 249
  - So use row index 5 (the "99" row)
*/

CREATE OR REPLACE FUNCTION calculate_imprint_price(
  p_imprint_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_price numeric := 0;
  v_imprint record;
  v_group_qty int;
  v_price_matrix record;
  v_row_index int;
  v_col_index int;
  v_cell_key text;
  v_price_value text;
  v_row_label text;
  v_threshold int;
  v_best_threshold int := 0;
  v_best_row_index int := 0;
BEGIN
  -- Get imprint details
  SELECT * INTO v_imprint
  FROM quote_imprints
  WHERE id = p_imprint_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get group quantity
  v_group_qty := get_group_total_quantity(v_imprint.quote_id, v_imprint.group_label);

  IF v_group_qty = 0 THEN
    RETURN 0;
  END IF;

  -- Get price matrix
  SELECT * INTO v_price_matrix
  FROM price_matrices
  WHERE id = v_imprint.price_matrix_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Determine row index based on quantity
  v_row_index := 0;
  
  FOR i IN 0..jsonb_array_length(v_price_matrix.rows) - 1 LOOP
    v_row_label := v_price_matrix.rows->>i;
    
    -- Check if it's a range format (e.g., "1-11", "99+")
    IF v_row_label LIKE '%+' THEN
      -- Format: "99+" means 99 or more
      v_threshold := substring(v_row_label FROM '(\d+)\+')::int;
      IF v_group_qty >= v_threshold THEN
        v_row_index := i;
      END IF;
    ELSIF v_row_label LIKE '%-%' THEN
      -- Format: "1-11" means 1 to 11
      DECLARE
        v_min_qty int := split_part(v_row_label, '-', 1)::int;
        v_max_qty int := split_part(v_row_label, '-', 2)::int;
      BEGIN
        IF v_group_qty >= v_min_qty AND v_group_qty <= v_max_qty THEN
          v_row_index := i;
          EXIT;
        END IF;
      END;
    ELSE
      -- Threshold format: just a number like "1", "12", "24"
      -- This means "quantity >= this threshold"
      -- Find the highest threshold that the quantity meets
      BEGIN
        v_threshold := v_row_label::int;
        IF v_group_qty >= v_threshold AND v_threshold >= v_best_threshold THEN
          v_best_threshold := v_threshold;
          v_best_row_index := i;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- If parsing fails, skip this row
          CONTINUE;
      END;
    END IF;
  END LOOP;

  -- Use the best threshold row index if we found one
  IF v_best_threshold > 0 THEN
    v_row_index := v_best_row_index;
  END IF;

  -- Determine column index based on number of colors or pricing_matrix_column
  IF v_imprint.pricing_matrix_column IS NOT NULL THEN
    -- Find the column index by name
    v_col_index := 0;
    FOR i IN 0..jsonb_array_length(v_price_matrix.columns) - 1 LOOP
      IF v_price_matrix.columns->>i = v_imprint.pricing_matrix_column THEN
        v_col_index := i;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- Use num_colors (subtract 1 for 0-based index)
    v_col_index := COALESCE(v_imprint.num_colors, 1) - 1;
  END IF;

  -- Get price from cells
  v_cell_key := v_row_index || '-' || v_col_index;
  v_price_value := v_price_matrix.cells->>v_cell_key;

  IF v_price_value IS NOT NULL AND v_price_value != '' THEN
    -- Handle both string and numeric values
    IF jsonb_typeof(v_price_matrix.cells->v_cell_key) = 'number' THEN
      v_price := (v_price_matrix.cells->>v_cell_key)::numeric;
    ELSE
      -- Remove dollar sign if present and convert to numeric
      v_price_value := replace(v_price_value, '$', '');
      v_price := v_price_value::numeric;
    END IF;
  END IF;

  RETURN v_price;
END;
$$;

COMMENT ON FUNCTION calculate_imprint_price IS 'Calculates price for an imprint. Handles both range formats (1-11, 99+) and threshold formats (1, 12, 24)';
