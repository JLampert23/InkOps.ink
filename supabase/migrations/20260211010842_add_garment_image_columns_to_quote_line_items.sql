-- Add garment image columns to quote_line_items table
-- These columns store URLs for garment images from various angles

-- Add columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'garment_image_url'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN garment_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'garment_image_rear_url'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN garment_image_rear_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'garment_image_side_url'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN garment_image_side_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_line_items' 
    AND column_name = 'garment_image_lifestyle_url'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN garment_image_lifestyle_url text;
  END IF;
END $$;
