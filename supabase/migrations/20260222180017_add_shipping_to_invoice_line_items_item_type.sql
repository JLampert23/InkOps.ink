/*
  # Add 'shipping' to Invoice Line Items Item Type

  1. Changes
    - Modify the item_type CHECK constraint on invoice_line_items table
    - Add 'shipping' as a valid item_type value
    - This allows shipping costs to be stored as line items

  2. Purpose
    - Enable shipping costs from ShipStation to be stored as invoice line items
    - Shipping line items will be automatically reflected in invoice totals
*/

-- Drop the existing constraint
ALTER TABLE invoice_line_items
DROP CONSTRAINT IF EXISTS invoice_line_items_item_type_check;

-- Add the new constraint with 'shipping' included
ALTER TABLE invoice_line_items
ADD CONSTRAINT invoice_line_items_item_type_check
CHECK (item_type IN ('garment', 'decoration', 'custom', 'fee', 'discount', 'shipping', 'other'));

COMMENT ON COLUMN invoice_line_items.item_type IS 'Line item type: garment, decoration, custom, fee, discount, shipping, other';