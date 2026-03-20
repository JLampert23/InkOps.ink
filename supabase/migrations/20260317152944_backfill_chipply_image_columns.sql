/*
  # Backfill Chipply Quote Images to Correct Columns

  1. Problem
    - Existing Chipply quotes have images in garment_image_url, garment_back_image_url
    - UI reads from garment_front_image_url, garment_rear_image_url
    
  2. Solution
    - Copy existing images to UI-compatible columns
*/

-- Copy garment_image_url to garment_front_image_url where missing
UPDATE quote_line_items
SET 
  garment_front_image_url = garment_image_url
WHERE garment_image_url IS NOT NULL
  AND garment_front_image_url IS NULL
  AND quote_id IN (
    SELECT id FROM quotes WHERE chipply_import_log_id IS NOT NULL
  );

-- Copy garment_back_image_url to garment_rear_image_url where missing  
UPDATE quote_line_items
SET 
  garment_rear_image_url = garment_back_image_url
WHERE garment_back_image_url IS NOT NULL
  AND garment_rear_image_url IS NULL
  AND quote_id IN (
    SELECT id FROM quotes WHERE chipply_import_log_id IS NOT NULL
  );