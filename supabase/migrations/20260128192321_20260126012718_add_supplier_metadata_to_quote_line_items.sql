/*
  # Add Supplier Metadata to Quote Line Items

  1. Changes
    - Add supplier-related fields to `quote_line_items` table
    - Add `supplier_name` - SanMar, SSActivewear, or manual entry
    - Add `brand` - product brand (e.g., Port & Company, Gildan)
    - Add `color_code` - supplier color code
    - Add `garment_image_url` - URL to product image
    - Add `wholesale_price` - wholesale cost per unit
    - Add `retail_price` - suggested retail price
    - Add `supplier_metadata` - full JSON response from supplier API
    - Add `stock_availability` - JSONB with warehouse stock levels

  2. Notes
    - These fields are optional and only populated when using supplier integrations
    - Manual line items can leave these fields NULL
    - supplier_metadata stores the complete API response for reference
*/

DO $$
BEGIN
  -- Add supplier_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'supplier_name'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN supplier_name text;
  END IF;

  -- Add brand
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'brand'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN brand text;
  END IF;

  -- Add color_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'color_code'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN color_code text;
  END IF;

  -- Add garment_image_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'garment_image_url'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN garment_image_url text;
  END IF;

  -- Add wholesale_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'wholesale_price'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN wholesale_price decimal(10,2);
  END IF;

  -- Add retail_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'retail_price'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN retail_price decimal(10,2);
  END IF;

  -- Add supplier_metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'supplier_metadata'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN supplier_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add stock_availability
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'stock_availability'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN stock_availability jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;