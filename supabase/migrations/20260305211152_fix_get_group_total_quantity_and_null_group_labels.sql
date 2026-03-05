/*
  # Fix get_group_total_quantity and NULL-safe group_label handling

  1. Bug Fix: get_group_total_quantity
    - Added COALESCE(total_quantity, 0) to the quantity sum
    - Previously only summed individual size columns (qty_xs, qty_s, etc.)
    - Items using the non-sized "Qty" column would return 0, causing
      calculate_imprint_price to select the wrong price matrix row
    - Now matches propagate_group_unit_price and frontend calculateItemsTotal()

  2. Defensive Fix: NULL-safe group_label comparisons
    - Changed WHERE group_label = p_group_label to use COALESCE
    - Prevents silent failures if NULL values enter the group_label column
    - Applied to: get_group_total_quantity, propagate_group_unit_price,
      calculate_line_item_unit_price, trigger_recalculate_on_line_item_change
*/

-- Fix 1: get_group_total_quantity - add total_quantity and NULL-safe group_label
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
    COALESCE(qty_3xl, 0) + COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0) +
    COALESCE(total_quantity, 0)
  ), 0)
  INTO v_total
  FROM quote_line_items
  WHERE quote_id = p_quote_id
    AND COALESCE(group_label, '') = COALESCE(p_group_label, '')
    AND (line_type = 'item' OR line_type IS NULL);

  RETURN v_total;
END;
$$;

-- Fix 2: propagate_group_unit_price - NULL-safe group_label
CREATE OR REPLACE FUNCTION propagate_group_unit_price(p_quote_id uuid, p_group_label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_imprint_price numeric := 0;
  v_garment_markup numeric := 0;
  v_company_id uuid;
  v_line_item record;
  v_garment_cost_with_markup numeric;
  v_unit_price numeric;
BEGIN
  SELECT company_id INTO v_company_id
  FROM quotes
  WHERE id = p_quote_id;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(default_garment_markup, 0) INTO v_garment_markup
  FROM company_settings
  WHERE id = v_company_id;

  SELECT COALESCE(SUM(price), 0) INTO v_total_imprint_price
  FROM quote_imprints
  WHERE quote_id = p_quote_id
    AND COALESCE(group_label, '') = COALESCE(p_group_label, '');

  FOR v_line_item IN
    SELECT id, wholesale_price,
      COALESCE(qty_yxs, 0) + COALESCE(qty_ys, 0) + COALESCE(qty_ysym, 0) +
      COALESCE(qty_ym, 0) + COALESCE(qty_yl, 0) + COALESCE(qty_ylyxl, 0) +
      COALESCE(qty_yxl, 0) + COALESCE(qty_xs, 0) + COALESCE(qty_s, 0) +
      COALESCE(qty_sm, 0) + COALESCE(qty_m, 0) + COALESCE(qty_l, 0) +
      COALESCE(qty_lxl, 0) + COALESCE(qty_xl, 0) + COALESCE(qty_2xl, 0) +
      COALESCE(qty_3xl, 0) + COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0) +
      COALESCE(total_quantity, 0) AS total_qty
    FROM quote_line_items
    WHERE quote_id = p_quote_id
      AND COALESCE(group_label, '') = COALESCE(p_group_label, '')
      AND (line_type = 'item' OR line_type IS NULL)
  LOOP
    v_garment_cost_with_markup := COALESCE(v_line_item.wholesale_price, 0) * (1 + v_garment_markup / 100);
    v_unit_price := v_total_imprint_price + v_garment_cost_with_markup;

    UPDATE quote_line_items
    SET unit_price = v_unit_price,
        total_price = v_unit_price * v_line_item.total_qty
    WHERE id = v_line_item.id;
  END LOOP;
END;
$$;

-- Fix 3: calculate_line_item_unit_price - NULL-safe group_label
CREATE OR REPLACE FUNCTION calculate_line_item_unit_price(
  p_line_item_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line_item record;
  v_total_imprint_price numeric := 0;
  v_wholesale_price numeric := 0;
  v_garment_markup numeric := 0;
  v_garment_cost_with_markup numeric := 0;
  v_company_id uuid;
BEGIN
  SELECT li.*, q.company_id
  INTO v_line_item
  FROM quote_line_items li
  JOIN quotes q ON q.id = li.quote_id
  WHERE li.id = p_line_item_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_company_id := v_line_item.company_id;
  v_wholesale_price := COALESCE(v_line_item.wholesale_price, 0);

  SELECT COALESCE(default_garment_markup, 0) INTO v_garment_markup
  FROM company_settings
  WHERE id = v_company_id;

  v_garment_cost_with_markup := v_wholesale_price * (1 + v_garment_markup / 100);

  SELECT COALESCE(SUM(price), 0) INTO v_total_imprint_price
  FROM quote_imprints
  WHERE quote_id = v_line_item.quote_id
    AND COALESCE(group_label, '') = COALESCE(v_line_item.group_label, '');

  RETURN v_total_imprint_price + v_garment_cost_with_markup;
END;
$$;

-- Fix 4: trigger_recalculate_on_line_item_change - NULL-safe group_label
CREATE OR REPLACE FUNCTION trigger_recalculate_on_line_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_label text;
  v_quote_id uuid;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  v_group_label := COALESCE(NEW.group_label, OLD.group_label);

  UPDATE quote_imprints
  SET price = calculate_imprint_price(id)
  WHERE quote_id = v_quote_id
    AND COALESCE(group_label, '') = COALESCE(v_group_label, '');

  PERFORM propagate_group_unit_price(v_quote_id, v_group_label);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
