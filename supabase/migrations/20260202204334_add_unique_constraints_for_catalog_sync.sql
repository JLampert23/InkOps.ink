/*
  # Add Unique Constraints for Catalog Sync

  ## Overview
  Adds unique constraints to support proper upsert operations during catalog sync.
  These constraints ensure data integrity and enable efficient ON CONFLICT clauses.

  ## Changes
  1. Add unique constraint on (company_id, style_number) for styles table
  2. Add unique constraint on (company_id, part_id) for parts table
  3. Add unique constraint on (company_id, part_id, warehouse) for inventory table
  4. Add unique constraint on (company_id, part_id, url) for images table

  ## Notes
  - Uses IF NOT EXISTS pattern to avoid errors on re-run
  - These constraints are essential for upsert operations
  - Prevents duplicate entries per company
*/

-- Add unique constraint for styles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'styles_company_style_unique'
  ) THEN
    ALTER TABLE styles 
    ADD CONSTRAINT styles_company_style_unique 
    UNIQUE (company_id, style_number);
  END IF;
END $$;

-- Add unique constraint for parts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'parts_company_part_unique'
  ) THEN
    ALTER TABLE parts 
    ADD CONSTRAINT parts_company_part_unique 
    UNIQUE (company_id, part_id);
  END IF;
END $$;

-- Add unique constraint for inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'inventory_company_part_warehouse_unique'
  ) THEN
    ALTER TABLE inventory 
    ADD CONSTRAINT inventory_company_part_warehouse_unique 
    UNIQUE (company_id, part_id, warehouse);
  END IF;
END $$;

-- Add unique constraint for images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'images_company_part_url_unique'
  ) THEN
    ALTER TABLE images 
    ADD CONSTRAINT images_company_part_url_unique 
    UNIQUE (company_id, part_id, url);
  END IF;
END $$;
