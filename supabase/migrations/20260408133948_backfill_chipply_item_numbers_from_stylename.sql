/*
  # Backfill Chipply Item Numbers from styleName

  ## Summary
  Updates existing Chipply-imported quote line items to populate the item_number 
  column with the garment style number from the original Chipply payload.

  ## Changes
  1. Extracts styleName from the stored Chipply raw JSON for each product/color
  2. Updates the item_number column for all affected quote_line_items
  3. Also updates the notes field to show the correct style instead of "N/A"

  ## Impact
  - Retroactively fixes the Item # column for all existing Chipply imports
  - No data loss
*/

WITH chipply_style_data AS (
  SELECT 
    q.id as quote_id,
    cil.raw_json->0->'workOrderData'->'processes' as processes
  FROM quotes q
  JOIN chipply_import_logs cil ON cil.id = q.chipply_import_log_id
  WHERE q.chipply_import_log_id IS NOT NULL
),
expanded_products AS (
  SELECT 
    csd.quote_id,
    proc_idx,
    prod_idx,
    color_idx,
    product->>'styleName' as style_name,
    product->>'productName' as product_name,
    product->>'vendorName' as vendor_name,
    color->>'colorName' as color_name
  FROM chipply_style_data csd,
  LATERAL jsonb_array_elements(csd.processes) WITH ORDINALITY AS proc(process, proc_idx),
  LATERAL jsonb_array_elements(proc.process->'products') WITH ORDINALITY AS prod(product, prod_idx),
  LATERAL jsonb_array_elements(prod.product->'productColors') WITH ORDINALITY AS col(color, color_idx)
)
UPDATE quote_line_items qli
SET 
  item_number = ep.style_name,
  notes = 'Vendor: ' || COALESCE(ep.vendor_name, 'N/A') ||
          E'\nStyle: ' || COALESCE(ep.style_name, 'N/A') ||
          E'\nColor: ' || COALESCE(ep.color_name, 'N/A')
FROM expanded_products ep
WHERE qli.quote_id = ep.quote_id
  AND qli.item_number IS NULL
  AND qli.line_type = 'item'
  AND qli.color = ep.color_name
  AND qli.description LIKE '%' || ep.style_name || '%';