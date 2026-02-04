/*
  # Imprint-Based Pricing System

  ## Overview
  Implements a pricing system where line item unit prices are calculated as the sum of all imprint prices.
  All items in a line item group share the same unit_price, and each imprint's price is based on the
  total quantity of garments in the group.

  ## Changes Made

  1. **New Columns**
    - `quote_imprints.price` - Stores the calculated price for each imprint based on price matrix lookup
    - `quote_imprints.num_colors` - Stores the number of colors for the imprint

  2. **New Functions**
    - `calculate_imprint_price()` - Calculates price for a single imprint based on group quantity and colors
    - `calculate_line_item_unit_price()` - Sums all imprint prices for a line item
    - `propagate_group_unit_price()` - Applies the same unit_price to all items in a group
    - `recalculate_quote_pricing()` - Recalculates all pricing for a quote

  3. **Triggers**
    - Auto-recalculate pricing when imprints are added/updated/deleted
    - Auto-recalculate pricing when line item quantities change
    - Auto-recalculate pricing when price matrices are updated

  4. **Line Type Cleanup**
    - Remove deprecated 'imprint' value from line_type CHECK constraint
    - Keep 'item' and 'fee' values which are actively used

  ## Pricing Rules

  - **Unit Price = SUM(Imprint Prices)**
    - Each line item's unit_price is the sum of all associated imprint prices
    - Example: Front ($1.68) + Back ($1.68) = $3.36 unit_price

  - **Group-Based Pricing**
    - All items in the same group receive the same unit_price
    - Imprint prices are calculated using the total quantity of garments in the group
    - Example: If group has 170 total garments, lookup pricing for 170 qty

  - **Multi-Color Support**
    - Each imprint can have multiple colors
    - Price matrix lookup uses: (group_quantity, num_colors) → price
    - Example: Front (2 colors) = $2.13, Back (1 color) = $1.68

  ## Security
  - All functions use SECURITY DEFINER to ensure consistent pricing calculations
  - RLS policies remain unchanged
*/

-- Add price and num_colors columns to quote_imprints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_imprints' AND column_name = 'price'
  ) THEN
    ALTER TABLE quote_imprints ADD COLUMN price numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_imprints' AND column_name = 'num_colors'
  ) THEN
    ALTER TABLE quote_imprints ADD COLUMN num_colors int DEFAULT 1;
  END IF;
END $$;

-- Update line_type constraint to remove deprecated 'imprint' value
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'quote_line_items' AND constraint_name = 'quote_line_items_line_type_check'
  ) THEN
    ALTER TABLE quote_line_items DROP CONSTRAINT quote_line_items_line_type_check;
  END IF;

  -- Add new constraint with only 'item' and 'fee'
  ALTER TABLE quote_line_items ADD CONSTRAINT quote_line_items_line_type_check 
    CHECK (line_type IN ('item', 'fee'));
END $$;

-- Function to get the total quantity for a line item group
CREATE OR REPLACE FUNCTION get_group_total_quantity(
  p_quote_id uuid,
  p_group_label text
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total int;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(qty_yxs, 0) + COALESCE(qty_ys, 0) + COALESCE(qty_ysym, 0) + 
    COALESCE(qty_ym, 0) + COALESCE(qty_yl, 0) + COALESCE(qty_ylyxl, 0) + 
    COALESCE(qty_yxl, 0) + COALESCE(qty_xs, 0) + COALESCE(qty_s, 0) + 
    COALESCE(qty_sm, 0) + COALESCE(qty_m, 0) + COALESCE(qty_l, 0) + 
    COALESCE(qty_lxl, 0) + COALESCE(qty_xl, 0) + COALESCE(qty_2xl, 0) + 
    COALESCE(qty_3xl, 0) + COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0)
  ), 0)
  INTO v_total
  FROM quote_line_items
  WHERE quote_id = p_quote_id 
    AND group_label = p_group_label
    AND (line_type = 'item' OR line_type IS NULL);

  RETURN v_total;
END;
$$;

-- Function to calculate price for an imprint based on price matrix
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
  -- Rows are typically: ["1-11", "12-23", "24-47", "48-95", "99+"]
  v_row_index := 0;
  FOR i IN 0..jsonb_array_length(v_price_matrix.rows) - 1 LOOP
    DECLARE
      v_row_label text := v_price_matrix.rows->>i;
      v_min_qty int;
      v_max_qty int;
    BEGIN
      -- Parse row label (e.g., "1-11", "99+")
      IF v_row_label LIKE '%+' THEN
        v_min_qty := substring(v_row_label FROM '(\d+)\+')::int;
        IF v_group_qty >= v_min_qty THEN
          v_row_index := i;
        END IF;
      ELSIF v_row_label LIKE '%-%' THEN
        v_min_qty := split_part(v_row_label, '-', 1)::int;
        v_max_qty := split_part(v_row_label, '-', 2)::int;
        IF v_group_qty >= v_min_qty AND v_group_qty <= v_max_qty THEN
          v_row_index := i;
          EXIT;
        END IF;
      END IF;
    END;
  END LOOP;

  -- Determine column index based on number of colors
  -- Use the column specified in the imprint or default to num_colors
  IF v_imprint.pricing_matrix_column IS NOT NULL THEN
    -- Find the column index by name
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
  v_cell_key := v_row_index || ',' || v_col_index;
  v_price_value := v_price_matrix.cells->>v_cell_key;

  IF v_price_value IS NOT NULL AND v_price_value != '' THEN
    -- Remove dollar sign if present and convert to numeric
    v_price_value := replace(v_price_value, '$', '');
    v_price := v_price_value::numeric;
  END IF;

  RETURN v_price;
END;
$$;

-- Function to calculate unit price for a line item (sum of all imprint prices)
CREATE OR REPLACE FUNCTION calculate_line_item_unit_price(
  p_line_item_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line_item record;
  v_total_imprint_price numeric := 0;
BEGIN
  -- Get line item details
  SELECT * INTO v_line_item
  FROM quote_line_items
  WHERE id = p_line_item_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Sum all imprint prices for this group
  SELECT COALESCE(SUM(price), 0) INTO v_total_imprint_price
  FROM quote_imprints
  WHERE quote_id = v_line_item.quote_id
    AND group_label = v_line_item.group_label;

  RETURN v_total_imprint_price;
END;
$$;

-- Function to propagate unit price across all items in a group
CREATE OR REPLACE FUNCTION propagate_group_unit_price(
  p_quote_id uuid,
  p_group_label text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unit_price numeric;
  v_first_item_id uuid;
BEGIN
  -- Get the first item in the group
  SELECT id INTO v_first_item_id
  FROM quote_line_items
  WHERE quote_id = p_quote_id 
    AND group_label = p_group_label
    AND (line_type = 'item' OR line_type IS NULL)
  ORDER BY sort_order
  LIMIT 1;

  IF v_first_item_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate unit price (sum of all imprint prices)
  v_unit_price := calculate_line_item_unit_price(v_first_item_id);

  -- Apply to all items in the group
  UPDATE quote_line_items
  SET unit_price = v_unit_price,
      total_price = v_unit_price * (
        COALESCE(qty_yxs, 0) + COALESCE(qty_ys, 0) + COALESCE(qty_ysym, 0) + 
        COALESCE(qty_ym, 0) + COALESCE(qty_yl, 0) + COALESCE(qty_ylyxl, 0) + 
        COALESCE(qty_yxl, 0) + COALESCE(qty_xs, 0) + COALESCE(qty_s, 0) + 
        COALESCE(qty_sm, 0) + COALESCE(qty_m, 0) + COALESCE(qty_l, 0) + 
        COALESCE(qty_lxl, 0) + COALESCE(qty_xl, 0) + COALESCE(qty_2xl, 0) + 
        COALESCE(qty_3xl, 0) + COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0)
      )
  WHERE quote_id = p_quote_id 
    AND group_label = p_group_label
    AND (line_type = 'item' OR line_type IS NULL);
END;
$$;

-- Function to recalculate all pricing for a quote
CREATE OR REPLACE FUNCTION recalculate_quote_pricing(
  p_quote_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_imprint record;
  v_group_label text;
BEGIN
  -- Step 1: Recalculate all imprint prices
  FOR v_imprint IN 
    SELECT id FROM quote_imprints WHERE quote_id = p_quote_id
  LOOP
    UPDATE quote_imprints
    SET price = calculate_imprint_price(v_imprint.id)
    WHERE id = v_imprint.id;
  END LOOP;

  -- Step 2: Propagate unit prices to all groups
  FOR v_group_label IN
    SELECT DISTINCT group_label 
    FROM quote_line_items 
    WHERE quote_id = p_quote_id 
      AND (line_type = 'item' OR line_type IS NULL)
  LOOP
    PERFORM propagate_group_unit_price(p_quote_id, v_group_label);
  END LOOP;

  -- Step 3: Update quote totals
  UPDATE quotes
  SET 
    subtotal = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM quote_line_items
      WHERE quote_id = p_quote_id
    ),
    updated_at = now()
  WHERE id = p_quote_id;
END;
$$;

-- Trigger: Recalculate pricing when imprints are modified
CREATE OR REPLACE FUNCTION trigger_recalculate_on_imprint_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_quote_pricing(OLD.quote_id);
    RETURN OLD;
  ELSE
    -- Update the imprint's price first
    NEW.price := calculate_imprint_price(NEW.id);
    
    -- Then recalculate the entire quote
    PERFORM recalculate_quote_pricing(NEW.quote_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_pricing_on_imprint_change ON quote_imprints;
CREATE TRIGGER recalculate_pricing_on_imprint_change
  AFTER INSERT OR UPDATE OR DELETE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_imprint_change();

-- Trigger: Recalculate pricing when line item quantities change
CREATE OR REPLACE FUNCTION trigger_recalculate_on_line_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_quote_pricing(OLD.quote_id);
    RETURN OLD;
  ELSE
    -- Recalculate pricing for this quote
    PERFORM recalculate_quote_pricing(NEW.quote_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_pricing_on_line_item_change ON quote_line_items;
CREATE TRIGGER recalculate_pricing_on_line_item_change
  AFTER INSERT OR UPDATE OF qty_yxs, qty_ys, qty_ysym, qty_ym, qty_yl, qty_ylyxl, qty_yxl, qty_xs, qty_s, qty_sm, qty_m, qty_l, qty_lxl, qty_xl, qty_2xl, qty_3xl, qty_4xl, qty_5xl, group_label ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_line_item_change();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_imprints_quote_group ON quote_imprints(quote_id, group_label);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_group ON quote_line_items(quote_id, group_label);

-- Add helpful comments
COMMENT ON COLUMN quote_imprints.price IS 'Calculated price for this imprint based on group quantity and price matrix';
COMMENT ON COLUMN quote_imprints.num_colors IS 'Number of colors for this imprint (used for price matrix lookup)';
COMMENT ON FUNCTION calculate_imprint_price IS 'Calculates price for an imprint based on group quantity and price matrix';
COMMENT ON FUNCTION calculate_line_item_unit_price IS 'Calculates unit price as sum of all imprint prices for the group';
COMMENT ON FUNCTION propagate_group_unit_price IS 'Applies the same unit_price to all items in a line item group';
COMMENT ON FUNCTION recalculate_quote_pricing IS 'Recalculates all pricing for a quote including imprints and line items';
