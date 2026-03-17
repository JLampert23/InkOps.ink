/*
  # Cleanup Existing Chipply Imports - Fix Qty Double Counting

  1. Problem
    - Existing Chipply-imported quotes have quantity field set to total quantity
    - This causes double counting in Quote View (size totals + quantity field)
    - Need to fix historical data to match new import behavior

  2. Solution
    - Identify all line items with both size quantities AND non-zero quantity field
    - Set quantity field to 0 for these items
    - Only affects Chipply-imported quotes (identified by chipply_import_log_id)

  3. Safety
    - Only updates line items where size columns have data (sum > 0)
    - Preserves non-garment items where quantity field is legitimately used
    - Uses safe UPDATE with WHERE conditions to avoid affecting manually created quotes
*/

-- Fix existing Chipply-imported line items where quantity is duplicating size totals
UPDATE quote_line_items
SET quantity = 0
WHERE quote_id IN (
  SELECT id FROM quotes WHERE chipply_import_log_id IS NOT NULL
)
AND (
  COALESCE(qty_yxs, 0) + COALESCE(qty_ys, 0) + COALESCE(qty_ym, 0) + 
  COALESCE(qty_yl, 0) + COALESCE(qty_yxl, 0) + COALESCE(qty_xs, 0) + 
  COALESCE(qty_s, 0) + COALESCE(qty_m, 0) + COALESCE(qty_l, 0) + 
  COALESCE(qty_xl, 0) + COALESCE(qty_2xl, 0) + COALESCE(qty_3xl, 0) + 
  COALESCE(qty_4xl, 0) + COALESCE(qty_5xl, 0)
) > 0
AND quantity > 0;