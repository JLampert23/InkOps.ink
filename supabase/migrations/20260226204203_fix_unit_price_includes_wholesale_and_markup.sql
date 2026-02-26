/*
  # Fix Unit Price Calculation to Include Wholesale Price + Garment Markup

  ## Problem
  The `propagate_group_unit_price` function was only summing imprint prices.
  It was NOT including:
  - The wholesale price of the garment (stored in `wholesale_price` column)
  - The garment markup from company settings (`default_garment_markup`)

  ## Solution
  Update the pricing functions to:
  1. Get the wholesale price from each line item
  2. Get the garment markup percentage from company settings
  3. Calculate: unit_price = imprint_total + (wholesale_price * (1 + markup/100))

  ## Formula
  unit_price = SUM(imprint_prices) + (wholesale_price * (1 + default_garment_markup / 100))
*/

-- Drop and recreate calculate_line_item_unit_price to include wholesale + markup
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
  -- Get line item details including wholesale_price
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

  -- Get garment markup from company settings
  SELECT COALESCE(default_garment_markup, 0) INTO v_garment_markup
  FROM company_settings
  WHERE id = v_company_id;

  -- Calculate garment cost with markup
  v_garment_cost_with_markup := v_wholesale_price * (1 + v_garment_markup / 100);

  -- Sum all imprint prices for this group
  SELECT COALESCE(SUM(price), 0) INTO v_total_imprint_price
  FROM quote_imprints
  WHERE quote_id = v_line_item.quote_id
    AND group_label = v_line_item.group_label;

  -- Return imprint total + garment cost with markup
  RETURN v_total_imprint_price + v_garment_cost_with_markup;
END;
$$;

COMMENT ON FUNCTION calculate_line_item_unit_price IS 'Calculates unit price: SUM(imprint prices) + (wholesale_price * (1 + markup%))';

-- Update propagate_group_unit_price to calculate per-item (since each item may have different wholesale prices)
CREATE OR REPLACE FUNCTION propagate_group_unit_price(
  p_quote_id uuid,
  p_group_label text
) RETURNS void
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
  -- Get company_id from quote
  SELECT company_id INTO v_company_id
  FROM quotes
  WHERE id = p_quote_id;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  -- Get garment markup from company settings
  SELECT COALESCE(default_garment_markup, 0) INTO v_garment_markup
  FROM company_settings
  WHERE id = v_company_id;

  -- Sum all imprint prices for this group
  SELECT COALESCE(SUM(price), 0) INTO v_total_imprint_price
  FROM quote_imprints
  WHERE quote_id = p_quote_id
    AND group_label = p_group_label;

  -- Update each item with its own unit_price based on its wholesale_price
  FOR v_line_item IN
    SELECT id, wholesale_price,
           COALESCE(qty_yxs, 0) + COALESCE(qty_ys, 0) + COALESCE(qty_ysym, 0) + 
           COALESCE(qty_ym, 0) + COALESCE(qty_yl, 0) + COALESCE(qty_ylyxl, 0) + 
           COALESCE(qty_yxl, 0) + COALESCE(qty_xs, 0) + COALESCE(qty_s, 0) + 
           COALESCE(qty_sm, 0) + COALESCE(qty_m, 0) + COALESCE(qty_l, 0) + 
           COALESCE(qty_lxl, 0) + COALESCE(qty_xl, 0) + COALESCE(qty_2xl, 0) + 
           COALESCE(qty_3xl, 0) + COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0) AS total_qty
    FROM quote_line_items
    WHERE quote_id = p_quote_id 
      AND group_label = p_group_label
      AND (line_type = 'item' OR line_type IS NULL)
  LOOP
    -- Calculate garment cost with markup for this specific item
    v_garment_cost_with_markup := COALESCE(v_line_item.wholesale_price, 0) * (1 + v_garment_markup / 100);
    
    -- Unit price = imprint total + garment with markup
    v_unit_price := v_total_imprint_price + v_garment_cost_with_markup;
    
    -- Update this specific line item
    UPDATE quote_line_items
    SET unit_price = v_unit_price,
        total_price = v_unit_price * v_line_item.total_qty
    WHERE id = v_line_item.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION propagate_group_unit_price IS 'Updates unit_price for all items in a group: imprint_total + (wholesale_price * (1 + markup%))';
