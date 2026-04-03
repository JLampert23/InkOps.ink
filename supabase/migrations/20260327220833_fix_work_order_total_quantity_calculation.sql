/*
  # Fix work order total_quantity calculation

  1. Changes
    - Add trigger to recalculate work_order.total_quantity when line items change
    - Backfill existing work orders with correct total_quantity

  2. Security
    - Trigger runs as definer with proper security context
*/

-- Function to recalculate work order total quantity
CREATE OR REPLACE FUNCTION recalculate_work_order_total_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order_id uuid;
  v_total_quantity int;
BEGIN
  -- Get the work order ID
  IF TG_OP = 'DELETE' THEN
    v_work_order_id := OLD.work_order_id;
  ELSE
    v_work_order_id := NEW.work_order_id;
  END IF;

  -- Calculate total quantity from line items
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_quantity
  FROM work_order_line_items
  WHERE work_order_id = v_work_order_id;

  -- Update the work order
  UPDATE work_orders
  SET total_quantity = v_total_quantity,
      updated_at = now()
  WHERE id = v_work_order_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS recalculate_work_order_quantity_trigger ON work_order_line_items;

-- Create trigger on work order line items
CREATE TRIGGER recalculate_work_order_quantity_trigger
  AFTER INSERT OR UPDATE OF quantity OR DELETE
  ON work_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_work_order_total_quantity();

-- Backfill existing work orders
DO $$
DECLARE
  v_work_order RECORD;
  v_total_quantity int;
BEGIN
  FOR v_work_order IN
    SELECT id FROM work_orders
  LOOP
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_quantity
    FROM work_order_line_items
    WHERE work_order_id = v_work_order.id;

    UPDATE work_orders
    SET total_quantity = v_total_quantity
    WHERE id = v_work_order.id;
  END LOOP;
END $$;
