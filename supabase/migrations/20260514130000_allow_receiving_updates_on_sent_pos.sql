/*
  # Allow receiving column updates on sent POs

  ## Why
    Migration 20260209151036_prevent_modifying_sent_pos.sql added a
    BEFORE UPDATE trigger on purchase_order_line_items that raises an
    exception if the parent PO's status != 'draft'.

    But process_receiving (migration 20260206154410) UPDATES the
    quantity_received / quantity_damaged / quantity_short columns on
    those exact line items during the receiving flow — which by
    definition only runs against sent / confirmed / partially_received
    POs.

    Result: every PO receive attempt raised the "Cannot modify line
    items for a purchase order that has been sent" exception, which
    was swallowed by process_receiving's EXCEPTION WHEN OTHERS handler
    and returned `{success: false, message: ...}`. The React layer
    didn't inspect data.success (fixed in 2026-05-14 commit) so the
    user saw "Goods received successfully" while nothing actually
    saved. Reported by client 2026-05-14.

  ## What changes
    Replace check_po_is_draft with a version that ALLOWS updates when
    only the receiving-tracking columns (quantity_received,
    quantity_damaged, quantity_short) change. Any other column edit on
    a sent PO still raises the same exception.

    INSERT and DELETE behavior is unchanged — both still blocked on
    non-draft POs.

  ## Safe to re-run
    CREATE OR REPLACE replaces the function in place. Triggers stay
    bound to the new function body automatically. No data migration
    needed.
*/

CREATE OR REPLACE FUNCTION check_po_is_draft()
RETURNS TRIGGER AS $$
DECLARE
  po_status TEXT;
BEGIN
  SELECT status INTO po_status
  FROM purchase_orders
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);

  IF po_status IS NULL OR po_status = 'draft' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- For UPDATE on a non-draft PO: allow ONLY the receiving columns to
  -- change. Everything else (style_number, color, size, quantity_ordered,
  -- unit_cost, etc.) remains locked.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.style_number IS NOT DISTINCT FROM NEW.style_number
      AND OLD.color IS NOT DISTINCT FROM NEW.color
      AND OLD.size IS NOT DISTINCT FROM NEW.size
      AND OLD.quantity_ordered IS NOT DISTINCT FROM NEW.quantity_ordered
      AND OLD.unit_cost IS NOT DISTINCT FROM NEW.unit_cost
      AND OLD.product_name IS NOT DISTINCT FROM NEW.product_name
      AND OLD.upc_code IS NOT DISTINCT FROM NEW.upc_code
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Cannot modify line items for a purchase order that has been sent. Only draft POs can be modified.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
