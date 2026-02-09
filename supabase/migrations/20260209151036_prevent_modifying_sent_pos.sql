/*
  # Prevent Modifying Sent Purchase Orders

  1. Security
    - Add trigger to prevent adding line items to sent POs
    - Add trigger to prevent updating line items on sent POs
    - Add trigger to prevent deleting line items from sent POs
    - Ensure POs cannot be modified once they've been sent to vendors

  2. Business Logic
    - Only draft POs can have line items added, updated, or deleted
    - Once a PO is sent (status != 'draft'), it is locked for modifications
    - This prevents accidental changes to orders that have been communicated to vendors
*/

-- Function to check if PO is in draft status
CREATE OR REPLACE FUNCTION check_po_is_draft()
RETURNS TRIGGER AS $$
DECLARE
  po_status TEXT;
BEGIN
  -- Get the status of the PO
  SELECT status INTO po_status
  FROM purchase_orders
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);

  -- If PO is not in draft status, prevent the operation
  IF po_status IS NOT NULL AND po_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot modify line items for a purchase order that has been sent. Only draft POs can be modified.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent inserting line items to sent POs
DROP TRIGGER IF EXISTS prevent_insert_items_to_sent_po ON purchase_order_line_items;
CREATE TRIGGER prevent_insert_items_to_sent_po
  BEFORE INSERT ON purchase_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION check_po_is_draft();

-- Trigger to prevent updating line items on sent POs
DROP TRIGGER IF EXISTS prevent_update_items_on_sent_po ON purchase_order_line_items;
CREATE TRIGGER prevent_update_items_on_sent_po
  BEFORE UPDATE ON purchase_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION check_po_is_draft();

-- Trigger to prevent deleting line items from sent POs
DROP TRIGGER IF EXISTS prevent_delete_items_from_sent_po ON purchase_order_line_items;
CREATE TRIGGER prevent_delete_items_from_sent_po
  BEFORE DELETE ON purchase_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION check_po_is_draft();
