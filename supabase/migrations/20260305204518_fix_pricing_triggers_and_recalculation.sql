/*
  # Fix Pricing Triggers and Recalculation System

  ## Problem
  The database triggers that auto-recalculate line item prices from pricing matrices
  were missing from the live database. This meant:
  - Adding/changing imprints did NOT recalculate unit prices
  - Changing quantities did NOT re-lookup matrix pricing
  - Wholesale garment prices were not being added to decoration prices

  ## Changes

  1. **Fixed Trigger Functions**
    - `trigger_recalculate_on_imprint_change`: Changed to BEFORE trigger so it can
      set NEW.price. Handles INSERT, UPDATE, and DELETE. On INSERT/UPDATE it calculates
      the imprint price and propagates to the group. On DELETE it propagates remaining prices.
    - `trigger_recalculate_on_line_item_change`: Recalculates imprint prices and
      propagates unit prices when quantities or group labels change.

  2. **Restored Missing Triggers**
    - `recalculate_pricing_on_imprint_change` on `quote_imprints` (BEFORE INSERT OR UPDATE, AFTER DELETE)
    - `recalculate_pricing_on_line_item_change` on `quote_line_items` (AFTER UPDATE on qty columns)

  3. **Backfill**
    - Sets wholesale_price = 0 on all line items where it is currently NULL
    - This ensures the pricing formula always has a numeric value to work with

  ## Pricing Formula
  unit_price = SUM(imprint_prices_from_matrix) + (wholesale_price * (1 + garment_markup% / 100))
*/

-- Step 1: Fix trigger function for imprint changes
-- Must be BEFORE trigger for INSERT/UPDATE so we can modify NEW.price
-- Must handle DELETE separately since NEW doesn't exist
CREATE OR REPLACE FUNCTION trigger_recalculate_on_imprint_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM propagate_group_unit_price(OLD.quote_id, OLD.group_label);
    RETURN OLD;
  ELSE
    NEW.price := calculate_imprint_price(NEW.id);
    RETURN NEW;
  END IF;
END;
$$;

-- Step 2: Create a separate AFTER trigger function to propagate prices after imprint insert/update
CREATE OR REPLACE FUNCTION trigger_propagate_after_imprint_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM propagate_group_unit_price(
    COALESCE(NEW.quote_id, OLD.quote_id),
    COALESCE(NEW.group_label, OLD.group_label)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Step 3: Fix trigger function for line item changes
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
    AND group_label = v_group_label;

  PERFORM propagate_group_unit_price(v_quote_id, v_group_label);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Step 4: Drop existing triggers if any, then recreate them

-- Imprint triggers: BEFORE for INSERT/UPDATE (to set NEW.price), separate AFTER DELETE
DROP TRIGGER IF EXISTS recalculate_pricing_on_imprint_change ON quote_imprints;
DROP TRIGGER IF EXISTS propagate_after_imprint_change ON quote_imprints;
DROP TRIGGER IF EXISTS recalculate_pricing_on_imprint_delete ON quote_imprints;

CREATE TRIGGER recalculate_pricing_on_imprint_change
  BEFORE INSERT OR UPDATE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_imprint_change();

CREATE TRIGGER propagate_after_imprint_change
  AFTER INSERT OR UPDATE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_propagate_after_imprint_change();

CREATE TRIGGER recalculate_pricing_on_imprint_delete
  AFTER DELETE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_imprint_change();

-- Line item trigger: recalculate when quantities or group label change
DROP TRIGGER IF EXISTS recalculate_pricing_on_line_item_change ON quote_line_items;

CREATE TRIGGER recalculate_pricing_on_line_item_change
  AFTER UPDATE OF qty_yxs, qty_ys, qty_ysym, qty_ym, qty_yl, qty_ylyxl,
    qty_yxl, qty_xs, qty_s, qty_sm, qty_m, qty_l, qty_lxl, qty_xl,
    qty_2xl, qty_3xl, qty_4xl, qty_5xl, group_label
  ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_line_item_change();

-- Step 5: Backfill NULL wholesale prices to 0
UPDATE quote_line_items
SET wholesale_price = 0
WHERE wholesale_price IS NULL
  AND (line_type = 'item' OR line_type IS NULL);
