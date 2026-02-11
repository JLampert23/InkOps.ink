/*
  # Add Multiple Artwork Images Support to Imprints

  1. Changes
    - Add `artwork_images` jsonb array column to store multiple artwork variation URLs
    - Keep the existing `artwork_url` column for backward compatibility
    - Add helper function to extract all artwork images
*/

-- Add artwork_images column to store multiple artwork URLs
ALTER TABLE quote_imprints 
ADD COLUMN IF NOT EXISTS artwork_images jsonb DEFAULT '[]'::jsonb;

-- Update existing records to populate artwork_images from artwork_url
UPDATE quote_imprints 
SET artwork_images = 
  CASE 
    WHEN artwork_url IS NOT NULL AND artwork_url != '' 
    THEN jsonb_build_array(artwork_url)
    ELSE '[]'::jsonb
  END
WHERE artwork_images = '[]'::jsonb;
