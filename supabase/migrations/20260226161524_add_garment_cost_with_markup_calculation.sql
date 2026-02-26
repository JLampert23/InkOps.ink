/*
  # Add Garment Cost with Markup Calculation

  1. New Functions
    - `calculate_garment_cost_with_markup(p_line_item_id)` 
      - Returns wholesale_price * (1 + default_garment_markup/100)
      - Returns 0 if wholesale_price is NULL

  2. Modified Functions
    - `propagate_group_unit_price(p_quote_id, p_group_label)`
      - Now combines imprint_price + garment_cost_with_markup
      - unit_price = imprint_cost + garment_cost_with_markup

  3. Pricing Formula
    - garment_cost_with_markup = wholesale_price * (1 + markup/100)
    - unit_price = imprint_price + garment_cost_with_markup
    - total_price = unit_price * total_quantity

  4. Notes
    - Imprint pricing is unchanged (calculate_imprint_price not modified)
    - Total price calculation unchanged (unit_price * quantity)
*/

-- Function to calculate garment cost with markup applied
CREATE OR REPLACE FUNCTION calculate_garment_cost_with_markup(
  p_line_item_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wholesale_price numeric;
  v_markup_percentage numeric;
  v_company_id uuid;
  v_quote_id uuid;
BEGIN
  -- Get wholesale price and quote_id from line item
  SELECT wholesale_price, quote_id INTO v_wholesale_price, v_quote_id
  FROM quote_line_items
  WHERE id = p_line_item_id;

  -- If no wholesale price, return 0 (no garment cost)
  IF v_wholesale_price IS NULL OR v_wholesale_price = 0 THEN
    RETURN 0;
  END IF;

  -- Get company_id from the quote
  SELECT company_id INTO v_company_id
  FROM quotes
  WHERE id = v_quote_id;

  IF v_company_id IS NULL THEN
    RETURN v_wholesale_price; -- No markup if no company found
  END IF;

  -- Get default markup from company settings
  SELECT COALESCE(default_garment_markup, 0) INTO v_markup_percentage
  FROM company_settings
  WHERE company_id = v_company_id;

  IF v_markup_percentage IS NULL THEN
    v_markup_percentage := 0;
  END IF;

  -- Calculate garment cost with markup: wholesale * (1 + markup/100)
  RETURN v_wholesale_price * (1 + v_markup_percentage / 100);
END;
$$;

COMMENT ON FUNCTION calculate_garment_cost_with_markup IS 'Calculates garment cost with company markup applied. Returns wholesale_price * (1 + default_garment_markup/100)';

-- Updated function to propagate unit price including garment cost
CREATE OR REPLACE FUNCTION propagate_group_unit_price(
  p_quote_id uuid,
  p_group_label text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_imprint_price numeric;
  v_garment_cost numeric;
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

  -- Calculate imprint price (sum of all imprint prices for the group)
  v_imprint_price := calculate_line_item_unit_price(v_first_item_id);

  -- Calculate garment cost with markup
  v_garment_cost := calculate_garment_cost_with_markup(v_first_item_id);

  -- Combine imprint price + garment cost with markup
  v_unit_price := v_imprint_price + v_garment_cost;

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

COMMENT ON FUNCTION propagate_group_unit_price IS 'Propagates combined unit price (imprint_cost + garment_cost_with_markup) to all items in a group';
