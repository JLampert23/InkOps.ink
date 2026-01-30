/*
  # Add Garment Image Fields to Quote Line Items

  1. Changes
    - Add garment image URL fields to `quote_line_items` table:
      - `garment_front_image_url` - URL for front view of garment
      - `garment_back_image_url` - URL for back view of garment
      - `garment_sleeve_image_url` - URL for sleeve/side view of garment
      - `garment_images_data` - JSONB field for additional image metadata

  2. Purpose
    - Store garment images automatically fetched from PromoStandards Media Content API
    - Enable Mockup Generator to auto-load garment images based on style/color selection
    - Improve user workflow by eliminating manual garment image uploads

  3. Notes
    - These fields are populated when a line item has both a style number and color selected
    - Images are fetched from SSActivewear PromoStandards Media Content 1.0.0
    - Non-breaking change - all fields are nullable
*/

-- Add garment image URL fields to quote_line_items
ALTER TABLE quote_line_items
ADD COLUMN IF NOT EXISTS garment_front_image_url text,
ADD COLUMN IF NOT EXISTS garment_back_image_url text,
ADD COLUMN IF NOT EXISTS garment_sleeve_image_url text,
ADD COLUMN IF NOT EXISTS garment_images_data jsonb;

-- Add index for faster queries on line items with images
CREATE INDEX IF NOT EXISTS idx_quote_line_items_garment_images 
ON quote_line_items (quote_id) 
WHERE garment_front_image_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN quote_line_items.garment_front_image_url IS 'Front view image URL from PromoStandards Media Content API';
COMMENT ON COLUMN quote_line_items.garment_back_image_url IS 'Back view image URL from PromoStandards Media Content API';
COMMENT ON COLUMN quote_line_items.garment_sleeve_image_url IS 'Sleeve/side view image URL from PromoStandards Media Content API';
COMMENT ON COLUMN quote_line_items.garment_images_data IS 'Additional image metadata and all available image URLs from PromoStandards';
