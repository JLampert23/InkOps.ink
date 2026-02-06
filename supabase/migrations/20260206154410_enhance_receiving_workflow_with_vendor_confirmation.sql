/*
  # Enhance Receiving Workflow with Vendor Confirmation and Job Readiness

  1. New Functions
    - `can_receive_po()` - Check if PO can be received (vendor confirmation enforcement)
    - `process_receiving()` - Main receiving processor with validation
    - `update_line_item_quantities()` - Update quantities on PO line items
    - `check_work_order_readiness()` - Check if work order has all garments
    - `update_work_order_status_after_receiving()` - Update work order to ready

  2. Enhanced Triggers
    - Enforce vendor confirmation before receiving
    - Update garment requirements staging
    - Check work order readiness
    - Update production schedule

  3. New Columns
    - `work_orders.garments_ready` (boolean) - All garments received
    - `work_orders.garments_received_at` (timestamptz) - When garments ready

  4. Purpose
    - Enforce vendor confirmation rules before receiving
    - Track received quantities accurately
    - Automatically update work order status when ready
    - Notify production scheduler when jobs ready to start
*/

-- Add columns to work_orders for garment readiness
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS garments_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS garments_received_at timestamptz,
ADD COLUMN IF NOT EXISTS ready_for_production boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ready_for_production_at timestamptz;

-- Create index for ready work orders
CREATE INDEX IF NOT EXISTS idx_work_orders_ready_for_production 
ON work_orders(company_id, ready_for_production) 
WHERE ready_for_production = true;

-- Function to check if PO can be received (vendor confirmation enforcement)
CREATE OR REPLACE FUNCTION can_receive_po(p_po_id uuid)
RETURNS boolean AS $$
DECLARE
  v_po_status text;
  v_company_id uuid;
  v_vendor_confirmation_required boolean;
BEGIN
  -- Get PO details
  SELECT po.status, po.company_id
  INTO v_po_status, v_company_id
  FROM purchase_orders po
  WHERE po.id = p_po_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  -- Check if PO is in draft status
  IF v_po_status = 'draft' THEN
    RETURN false;
  END IF;

  -- Get company settings for vendor confirmation requirement
  SELECT po_vendor_confirmation_required
  INTO v_vendor_confirmation_required
  FROM company_settings
  WHERE id = v_company_id;

  -- If vendor confirmation is required, check PO status
  IF COALESCE(v_vendor_confirmation_required, false) THEN
    -- Must be confirmed before receiving
    IF v_po_status NOT IN ('confirmed', 'in_transit', 'partially_received', 'fully_received') THEN
      RETURN false;
    END IF;
  ELSE
    -- If confirmation not required, just need to be sent
    IF v_po_status NOT IN ('sent', 'confirmed', 'in_transit', 'partially_received', 'fully_received') THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process receiving with validation
CREATE OR REPLACE FUNCTION process_receiving(
  p_po_id uuid,
  p_received_by uuid,
  p_line_items jsonb,
  p_notes text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_receiving_log_id uuid;
  v_line_item jsonb;
  v_po_line_item_id uuid;
  v_quantity_received integer;
  v_quantity_damaged integer;
  v_quantity_short integer;
  v_variance_notes text;
  v_company_id uuid;
  v_can_receive boolean;
  v_total_received integer := 0;
BEGIN
  -- Get company_id
  SELECT company_id INTO v_company_id
  FROM purchase_orders
  WHERE id = p_po_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  -- Check if PO can be received (vendor confirmation enforcement)
  v_can_receive := can_receive_po(p_po_id);

  IF NOT v_can_receive THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'vendor_confirmation_required',
      'message', 'This PO requires vendor confirmation before receiving. Please confirm the PO first.'
    );
  END IF;

  -- Create receiving log
  INSERT INTO receiving_logs (
    company_id,
    po_id,
    received_by,
    received_at,
    status,
    notes
  ) VALUES (
    v_company_id,
    p_po_id,
    p_received_by,
    now(),
    'partial',  -- Will be updated by trigger if complete
    p_notes
  ) RETURNING id INTO v_receiving_log_id;

  -- Process each line item
  FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_po_line_item_id := (v_line_item->>'po_line_item_id')::uuid;
    v_quantity_received := COALESCE((v_line_item->>'quantity_received')::integer, 0);
    v_quantity_damaged := COALESCE((v_line_item->>'quantity_damaged')::integer, 0);
    v_quantity_short := COALESCE((v_line_item->>'quantity_short')::integer, 0);
    v_variance_notes := v_line_item->>'variance_notes';

    -- Skip if no quantities
    IF v_quantity_received = 0 AND v_quantity_damaged = 0 AND v_quantity_short = 0 THEN
      CONTINUE;
    END IF;

    -- Create receiving line item
    INSERT INTO receiving_line_items (
      receiving_log_id,
      po_line_item_id,
      quantity_received,
      quantity_damaged,
      quantity_short,
      variance_notes
    ) VALUES (
      v_receiving_log_id,
      v_po_line_item_id,
      v_quantity_received,
      v_quantity_damaged,
      v_quantity_short,
      v_variance_notes
    );

    -- Update PO line item quantities
    UPDATE purchase_order_line_items
    SET
      quantity_received = quantity_received + v_quantity_received,
      quantity_damaged = quantity_damaged + v_quantity_damaged,
      quantity_short = quantity_short + v_quantity_short
    WHERE id = v_po_line_item_id;

    v_total_received := v_total_received + v_quantity_received;
  END LOOP;

  -- Log activity
  INSERT INTO purchase_order_activity_log (
    company_id,
    po_id,
    action,
    performed_by,
    performed_by_name,
    notes,
    meta
  ) VALUES (
    v_company_id,
    p_po_id,
    'items_received',
    p_received_by,
    (SELECT COALESCE(full_name, email) FROM user_profiles WHERE id = p_received_by),
    format('Received %s items', v_total_received),
    jsonb_build_object(
      'receiving_log_id', v_receiving_log_id,
      'total_received', v_total_received,
      'line_items_count', jsonb_array_length(p_line_items)
    )
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'receiving_log_id', v_receiving_log_id,
    'total_received', v_total_received,
    'message', format('Successfully received %s items', v_total_received)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if work order has all garments received
CREATE OR REPLACE FUNCTION check_work_order_readiness(p_work_order_id uuid)
RETURNS boolean AS $$
DECLARE
  v_requirements_count integer;
  v_requirements_with_po integer;
  v_total_needed integer;
  v_total_received integer;
BEGIN
  -- Count requirements for this work order
  SELECT COUNT(*)
  INTO v_requirements_count
  FROM garment_requirements_staging
  WHERE work_order_id = p_work_order_id;

  -- If no requirements, not ready
  IF v_requirements_count = 0 THEN
    RETURN false;
  END IF;

  -- Count requirements that have POs created
  SELECT COUNT(*)
  INTO v_requirements_with_po
  FROM garment_requirements_staging
  WHERE work_order_id = p_work_order_id
    AND is_po_created = true
    AND po_id IS NOT NULL;

  -- If not all requirements have POs, not ready
  IF v_requirements_with_po < v_requirements_count THEN
    RETURN false;
  END IF;

  -- Calculate total quantities needed vs received
  SELECT
    COALESCE(SUM(grs.total_quantity), 0),
    COALESCE(SUM(poli.quantity_received), 0)
  INTO v_total_needed, v_total_received
  FROM garment_requirements_staging grs
  LEFT JOIN purchase_order_line_items poli ON grs.po_id = poli.po_id
    AND grs.style_number = poli.style_number
    AND COALESCE(grs.color, '') = COALESCE(poli.color, '')
  WHERE grs.work_order_id = p_work_order_id;

  -- Check if all items received
  IF v_total_received >= v_total_needed THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to update work order status after receiving
CREATE OR REPLACE FUNCTION update_work_order_status_after_receiving()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id uuid;
  v_work_order_ids uuid[];
  v_work_order_id uuid;
  v_is_ready boolean;
BEGIN
  -- Get PO ID from receiving log
  SELECT po_id INTO v_po_id
  FROM receiving_logs
  WHERE id = NEW.receiving_log_id;

  -- Get all work orders linked to this PO via garment requirements
  SELECT ARRAY_AGG(DISTINCT work_order_id)
  INTO v_work_order_ids
  FROM garment_requirements_staging
  WHERE po_id = v_po_id
    AND work_order_id IS NOT NULL;

  -- Check each work order
  FOREACH v_work_order_id IN ARRAY v_work_order_ids
  LOOP
    -- Check if work order has all garments
    v_is_ready := check_work_order_readiness(v_work_order_id);

    IF v_is_ready THEN
      -- Update work order status
      UPDATE work_orders
      SET
        garments_ready = true,
        garments_received_at = COALESCE(garments_received_at, now()),
        ready_for_production = true,
        ready_for_production_at = COALESCE(ready_for_production_at, now()),
        status = CASE
          WHEN status = 'draft' THEN 'in_progress'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_work_order_id
        AND garments_ready = false;

      -- Log the status change
      IF FOUND THEN
        INSERT INTO purchase_order_activity_log (
          company_id,
          po_id,
          action,
          performed_by,
          performed_by_name,
          notes,
          meta
        )
        SELECT
          wo.company_id,
          v_po_id,
          'work_order_ready',
          NEW.receiving_log_id::text::uuid,  -- Use receiving log as reference
          'Receiving System',
          format('Work Order %s is now ready for production - all garments received', wo.work_order_number),
          jsonb_build_object(
            'work_order_id', v_work_order_id,
            'work_order_number', wo.work_order_number
          )
        FROM work_orders wo
        WHERE wo.id = v_work_order_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace existing trigger with enhanced version
DROP TRIGGER IF EXISTS trigger_check_job_readiness ON receiving_line_items;
CREATE TRIGGER trigger_update_work_order_after_receiving
  AFTER INSERT OR UPDATE ON receiving_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_status_after_receiving();

-- Function to get receivable POs (with vendor confirmation check)
CREATE OR REPLACE FUNCTION get_receivable_pos(p_company_id uuid DEFAULT NULL)
RETURNS TABLE (
  po_id uuid,
  po_number text,
  vendor_name text,
  status text,
  can_receive boolean,
  block_reason text,
  expected_delivery_date date,
  total_items integer,
  received_items integer,
  pending_items integer
) AS $$
DECLARE
  v_company_id uuid;
  v_vendor_confirmation_required boolean;
BEGIN
  -- Get company_id
  IF p_company_id IS NULL THEN
    v_company_id := get_user_company_id();
  ELSE
    v_company_id := p_company_id;
  END IF;

  -- Get vendor confirmation setting
  SELECT po_vendor_confirmation_required
  INTO v_vendor_confirmation_required
  FROM company_settings
  WHERE id = v_company_id;

  RETURN QUERY
  SELECT
    po.id,
    po.po_number,
    v.vendor_name,
    po.status,
    CASE
      -- Draft POs cannot be received
      WHEN po.status = 'draft' THEN false
      -- If vendor confirmation required
      WHEN COALESCE(v_vendor_confirmation_required, false) THEN
        po.status IN ('confirmed', 'in_transit', 'partially_received')
      -- If confirmation not required
      ELSE
        po.status IN ('sent', 'confirmed', 'in_transit', 'partially_received')
    END as can_receive,
    CASE
      WHEN po.status = 'draft' THEN 'PO is still in draft status'
      WHEN po.status = 'fully_received' THEN 'PO is already fully received'
      WHEN COALESCE(v_vendor_confirmation_required, false) AND po.status = 'sent' THEN 'Vendor confirmation required'
      ELSE NULL
    END as block_reason,
    po.expected_delivery_date,
    COALESCE(SUM(poli.quantity_ordered), 0)::integer as total_items,
    COALESCE(SUM(poli.quantity_received), 0)::integer as received_items,
    COALESCE(SUM(poli.quantity_ordered - poli.quantity_received), 0)::integer as pending_items
  FROM purchase_orders po
  JOIN vendors v ON po.vendor_id = v.id
  LEFT JOIN purchase_order_line_items poli ON po.id = poli.po_id
  WHERE po.company_id = v_company_id
    AND po.status NOT IN ('closed', 'cancelled')
  GROUP BY po.id, po.po_number, v.vendor_name, po.status, po.expected_delivery_date
  ORDER BY
    CASE
      WHEN po.status IN ('sent', 'confirmed', 'in_transit') THEN 1
      WHEN po.status = 'partially_received' THEN 2
      ELSE 3
    END,
    po.expected_delivery_date NULLS LAST,
    po.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION can_receive_po(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_receiving(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_work_order_readiness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_receivable_pos(uuid) TO authenticated;

COMMENT ON FUNCTION can_receive_po IS 'Check if PO can be received based on vendor confirmation settings and PO status';
COMMENT ON FUNCTION process_receiving IS 'Process receiving with vendor confirmation enforcement and validation';
COMMENT ON FUNCTION check_work_order_readiness IS 'Check if work order has all garments received and is ready for production';
COMMENT ON FUNCTION update_work_order_status_after_receiving IS 'Automatically update work order status when all garments received';
COMMENT ON FUNCTION get_receivable_pos IS 'Get list of POs that can be received with vendor confirmation enforcement';

COMMENT ON COLUMN work_orders.garments_ready IS 'All garments for this work order have been received';
COMMENT ON COLUMN work_orders.garments_received_at IS 'Timestamp when all garments became available';
COMMENT ON COLUMN work_orders.ready_for_production IS 'Work order is ready to start production';
COMMENT ON COLUMN work_orders.ready_for_production_at IS 'Timestamp when work order became ready for production';
