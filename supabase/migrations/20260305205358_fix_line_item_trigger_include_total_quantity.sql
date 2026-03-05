/*
  # Add total_quantity to line item pricing trigger

  ## Problem
  The `recalculate_pricing_on_line_item_change` trigger only fired when individual
  size columns changed (qty_xs, qty_s, etc.) but NOT when `total_quantity` changed.
  This meant changing the non-sized "Qty" field would not trigger a price recalculation.

  ## Changes
  - Recreated the trigger to also fire on `total_quantity` column changes
*/

DROP TRIGGER IF EXISTS recalculate_pricing_on_line_item_change ON quote_line_items;

CREATE TRIGGER recalculate_pricing_on_line_item_change
  AFTER UPDATE OF qty_yxs, qty_ys, qty_ysym, qty_ym, qty_yl, qty_ylyxl,
    qty_yxl, qty_xs, qty_s, qty_sm, qty_m, qty_l, qty_lxl, qty_xl,
    qty_2xl, qty_3xl, qty_4xl, qty_5xl, total_quantity, group_label
  ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_line_item_change();
