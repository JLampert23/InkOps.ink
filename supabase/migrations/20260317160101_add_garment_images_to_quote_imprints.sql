/*
  # Add Garment Images to Quote Imprints

  1. Purpose
    - Enable displaying garment images within imprint blocks
    - Store garment images as JSONB array similar to artwork_images
    - Each object contains url and view type (front/back/side)

  2. Changes
    - Add garment_images JSONB column to quote_imprints table
    - Default to empty array
*/

-- Add garment_images column to quote_imprints
ALTER TABLE quote_imprints
ADD COLUMN IF NOT EXISTS garment_images JSONB DEFAULT '[]'::jsonb;