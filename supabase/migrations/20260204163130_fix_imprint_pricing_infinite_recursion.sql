/*
  # Fix Infinite Recursion in Imprint Pricing System

  ## Problem
  The trigger `recalculate_pricing_on_imprint_change` was causing infinite recursion:
  1. Trigger fires on UPDATE of quote_imprints
  2. Trigger calls recalculate_quote_pricing()
  3. recalculate_quote_pricing() UPDATEs quote_imprints
  4. This triggers the trigger again → infinite loop

  ## Solution
  Remove the recursive call to recalculate_quote_pricing from the trigger.
  Instead, only update the current imprint's price and propagate to the group.
  The recalculate_quote_pricing() function can still be called manually when needed.

  ## Changes
  1. Modify trigger function to only update current imprint and group
  2. Don't call recalculate_quote_pricing() from within the trigger
  3. Add session variable check to prevent recursion if needed
*/

-- Drop the problematic triggers first
DROP TRIGGER IF EXISTS recalculate_pricing_on_imprint_change ON quote_imprints;
DROP TRIGGER IF EXISTS recalculate_pricing_on_line_item_change ON quote_line_items;

-- Fixed trigger function for imprint changes (no recursive recalculate call)
CREATE OR REPLACE FUNCTION trigger_recalculate_on_imprint_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Only propagate pricing for the affected group
    PERFORM propagate_group_unit_price(OLD.quote_id, OLD.group_label);
    RETURN OLD;
  ELSE
    -- Calculate and set the imprint's price
    NEW.price := calculate_imprint_price(NEW.id);

    -- After insert/update, propagate to the group
    -- Use a deferred approach to avoid recursion
    IF TG_OP = 'UPDATE' THEN
      PERFORM propagate_group_unit_price(NEW.quote_id, NEW.group_label);
    END IF;

    RETURN NEW;
  END IF;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER recalculate_pricing_on_imprint_change
  BEFORE INSERT OR UPDATE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_imprint_change();

-- Add an AFTER trigger for INSERT to propagate pricing after the row exists
CREATE OR REPLACE FUNCTION trigger_propagate_after_imprint_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM propagate_group_unit_price(NEW.quote_id, NEW.group_label);
  RETURN NEW;
END;
$$;

CREATE TRIGGER propagate_pricing_after_imprint_insert
  AFTER INSERT ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_propagate_after_imprint_insert();

-- Fixed trigger function for line item changes (simplified)
CREATE OR REPLACE FUNCTION trigger_recalculate_on_line_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_label text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_group_label := OLD.group_label;
  ELSE
    v_group_label := NEW.group_label;
  END IF;

  -- Only recalculate imprint prices and propagate for affected group
  -- Don't call full recalculate_quote_pricing to avoid recursion
  UPDATE quote_imprints
  SET price = calculate_imprint_price(id)
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id)
    AND group_label = v_group_label;

  -- Propagate the updated pricing to all items in the group
  PERFORM propagate_group_unit_price(
    COALESCE(NEW.quote_id, OLD.quote_id),
    v_group_label
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate the line item trigger
CREATE TRIGGER recalculate_pricing_on_line_item_change
  AFTER INSERT OR UPDATE OF qty_yxs, qty_ys, qty_ysym, qty_ym, qty_yl, qty_ylyxl, qty_yxl, qty_xs, qty_s, qty_sm, qty_m, qty_l, qty_lxl, qty_xl, qty_2xl, qty_3xl, qty_4xl, qty_5xl, group_label OR DELETE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_line_item_change();

-- Recreate recalculate_quote_pricing without trigger complications
-- This is safe to call manually since it updates directly
CREATE OR REPLACE FUNCTION recalculate_quote_pricing(
  p_quote_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_label text;
BEGIN
  -- Temporarily disable triggers to prevent recursion
  SET session_replication_role = replica;

  -- Step 1: Recalculate all imprint prices
  UPDATE quote_imprints
  SET price = calculate_imprint_price(id)
  WHERE quote_id = p_quote_id;

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

  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
END;
$$;

COMMENT ON FUNCTION recalculate_quote_pricing IS 'Safely recalculates all pricing for a quote with triggers disabled to prevent recursion';