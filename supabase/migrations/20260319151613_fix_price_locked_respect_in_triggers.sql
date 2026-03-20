/*
  # Fix price_locked to prevent recalculation

  1. Problem
    - The propagate_group_unit_price function doesn't respect price_locked flag
    - When duplicating quotes, prices are being recalculated even with price_locked = true
    - This causes imprint prices to be lost on duplication

  2. Solution
    - Update propagate_group_unit_price to skip recalculation when ANY item in the group has price_locked = true
    - This preserves the exact unit_price (garment cost + imprint prices) from the original quote

  3. Note
    - The unit_price column contains: SUM(imprint_prices) + (wholesale_price * (1 + markup%))
    - When price_locked = true, we must preserve this exact value
*/

-- Update propagate_group_unit_price to respect price_locked flag
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
  v_is_locked boolean;
  v_line_item RECORD;
BEGIN
  -- Check if any item in this group is price locked
  SELECT EXISTS(
    SELECT 1
    FROM quote_line_items
    WHERE quote_id = p_quote_id
      AND COALESCE(group_label, '') = COALESCE(p_group_label, '')
      AND (line_type = 'item' OR line_type IS NULL)
      AND price_locked = true
  ) INTO v_is_locked;

  -- If any item is locked, skip recalculation entirely
  IF v_is_locked THEN
    RETURN;
  END IF;

  -- Get first item in group
  SELECT id INTO v_first_item_id
  FROM quote_line_items
  WHERE quote_id = p_quote_id
    AND COALESCE(group_label, '') = COALESCE(p_group_label, '')
    AND (line_type = 'item' OR line_type IS NULL)
  ORDER BY line_number
  LIMIT 1;

  IF v_first_item_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate unit price (sum of all imprint prices + garment cost with markup)
  v_unit_price := calculate_line_item_unit_price(v_first_item_id);

  -- Apply to all unlocked items in the group
  FOR v_line_item IN
    SELECT id, qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl,
           qty_xs, qty_s, qty_m, qty_l, qty_xl,
           qty_2xl, qty_3xl, qty_4xl, qty_5xl,
           qty_sm, qty_lxl, qty_ysym, qty_ylyxl, total_quantity
    FROM quote_line_items
    WHERE quote_id = p_quote_id
      AND COALESCE(group_label, '') = COALESCE(p_group_label, '')
      AND (line_type = 'item' OR line_type IS NULL)
      AND (price_locked = false OR price_locked IS NULL)
  LOOP
    UPDATE quote_line_items
    SET unit_price = v_unit_price,
        total_price = v_unit_price * (
          COALESCE(v_line_item.qty_yxs, 0) + COALESCE(v_line_item.qty_ys, 0) +
          COALESCE(v_line_item.qty_ysym, 0) + COALESCE(v_line_item.qty_ym, 0) +
          COALESCE(v_line_item.qty_yl, 0) + COALESCE(v_line_item.qty_ylyxl, 0) +
          COALESCE(v_line_item.qty_yxl, 0) + COALESCE(v_line_item.qty_xs, 0) +
          COALESCE(v_line_item.qty_s, 0) + COALESCE(v_line_item.qty_sm, 0) +
          COALESCE(v_line_item.qty_m, 0) + COALESCE(v_line_item.qty_l, 0) +
          COALESCE(v_line_item.qty_lxl, 0) + COALESCE(v_line_item.qty_xl, 0) +
          COALESCE(v_line_item.qty_2xl, 0) + COALESCE(v_line_item.qty_3xl, 0) +
          COALESCE(v_line_item.qty_4xl, 0) + COALESCE(v_line_item.qty_5xl, 0) +
          COALESCE(v_line_item.total_quantity, 0)
        )
    WHERE id = v_line_item.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION propagate_group_unit_price IS 'Applies calculated unit_price to all unlocked items in a group. Skips recalculation if any item is price_locked.';