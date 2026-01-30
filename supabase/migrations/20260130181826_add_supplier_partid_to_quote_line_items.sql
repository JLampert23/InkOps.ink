/*
  # Add Supplier Part ID to Quote Line Items

  1. Changes
    - Add `supplier_partid` column to `quote_line_items` table
      - Stores the specific part ID from the supplier (e.g., SSActivewear partId)
      - Used to fetch pricing, inventory, and media content

  2. Purpose
    - Track the exact supplier part ID for each line item
    - Enable efficient lookups for inventory, pricing, and images
    - Support multi-supplier product sourcing

  3. Notes
    - Nullable field - only populated when sourcing from suppliers with part IDs
    - Non-breaking change
*/

-- Add supplier_partid column to quote_line_items
ALTER TABLE quote_line_items
ADD COLUMN IF NOT EXISTS supplier_partid text;

-- Add index for faster supplier part lookups
CREATE INDEX IF NOT EXISTS idx_quote_line_items_supplier_partid 
ON quote_line_items (supplier_partid) 
WHERE supplier_partid IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN quote_line_items.supplier_partid IS 'Supplier-specific part ID (e.g., SSActivewear partId for color/size combination)';
