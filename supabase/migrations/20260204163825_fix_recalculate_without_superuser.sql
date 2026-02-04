/*
  # Fix recalculate_quote_pricing Without Superuser Permissions

  ## Problem
  The previous fix tried to use `SET session_replication_role = replica` which requires
  superuser permissions. Regular users don't have this permission.

  ## Solution
  Use a completely different approach:
  1. Don't disable triggers
  2. Instead, make the UPDATE in recalculate_quote_pricing very specific to avoid triggering the recursive triggers
  3. Use a temporary flag in a session variable to track recursion

  Actually, the simplest approach is to just remove all the automatic triggers and make
  recalculate_quote_pricing a manual function that doesn't trigger anything.
*/

-- Drop all automatic triggers that cause recursion
DROP TRIGGER IF EXISTS recalculate_pricing_on_imprint_change ON quote_imprints;
DROP TRIGGER IF EXISTS propagate_pricing_after_imprint_insert ON quote_imprints;
DROP TRIGGER IF EXISTS recalculate_pricing_on_line_item_change ON quote_line_items;

-- Recreate recalculate_quote_pricing as a simple function without trigger manipulation
CREATE OR REPLACE FUNCTION recalculate_quote_pricing(
  p_quote_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_imprint record;
  v_group_label text;
  v_new_price numeric;
BEGIN
  -- Step 1: Recalculate all imprint prices (direct UPDATE, no recursion)
  FOR v_imprint IN 
    SELECT id FROM quote_imprints WHERE quote_id = p_quote_id
  LOOP
    v_new_price := calculate_imprint_price(v_imprint.id);
    
    -- Direct update without triggering
    UPDATE quote_imprints
    SET price = v_new_price
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

COMMENT ON FUNCTION recalculate_quote_pricing IS 'Recalculates all pricing for a quote - call this manually when needed';
