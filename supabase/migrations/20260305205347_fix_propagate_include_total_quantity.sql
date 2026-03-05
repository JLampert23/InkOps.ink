/*
  # Fix propagate_group_unit_price to include total_quantity

  ## Problem
  The `propagate_group_unit_price` function only summed individual size columns
  (qty_xs, qty_s, qty_m, etc.) but did NOT include the `total_quantity` field.
  Items that use the non-sized "Qty" column instead of size breakdowns would
  calculate total_price as $0.

  ## Changes
  - Added `COALESCE(total_quantity, 0)` to the quantity sum in `propagate_group_unit_price`
  - This matches the frontend `calculateItemsTotal()` logic which sums both

  ## Formula
  total_qty = SUM(all size columns) + total_quantity
  total_price = unit_price * total_qty
*/

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
    AND group_label = p_group_label;

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
      AND group_label = p_group_label
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
