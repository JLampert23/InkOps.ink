/*
  # Add Rear, Side, and Lifestyle Image Columns to Quote Line Items

  1. Changes
    - Add `garment_rear_image_url` column to store rear/back view images
    - Add `garment_side_image_url` column to store side/sleeve view images  
    - Add `garment_lifestyle_image_url` column to store lifestyle images
    
  2. Notes
    - These align with SSActivewear's actual image naming: Front, Rear, Side, Lifestyle
    - Existing `garment_back_image_url` and `garment_sleeve_image_url` columns remain for backward compatibility
    - New columns will be populated by the updated promostandards-unified edge function
*/

-- Add new image columns for proper SSActivewear image types
ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS garment_rear_image_url text,
  ADD COLUMN IF NOT EXISTS garment_side_image_url text,
  ADD COLUMN IF NOT EXISTS garment_lifestyle_image_url text;
