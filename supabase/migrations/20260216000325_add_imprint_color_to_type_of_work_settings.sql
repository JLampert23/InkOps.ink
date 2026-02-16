/*
  # Add Imprint Color to Type of Work Settings

  1. Changes
    - Add `imprint_color` column to `type_of_work_settings` table
    - Store HEX color values for each imprint type
    - Default to null (will use neutral gray in UI when not set)

  2. Purpose
    - Allow users to customize the color for each imprint type
    - Integrate custom colors into Kanban Calendar for visual identification
    - Improve visual scanning and organization in production scheduling

  3. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add imprint_color column to type_of_work_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'type_of_work_settings' AND column_name = 'imprint_color'
  ) THEN
    ALTER TABLE type_of_work_settings
    ADD COLUMN imprint_color text;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN type_of_work_settings.imprint_color IS 'HEX color code for visual identification in Kanban and other views';

-- Set default colors for existing records based on common imprint types
UPDATE type_of_work_settings 
SET imprint_color = '#10b981' 
WHERE work_type_name = 'Screen Print' AND imprint_color IS NULL;

UPDATE type_of_work_settings 
SET imprint_color = '#3b82f6' 
WHERE work_type_name = 'Embroidery' AND imprint_color IS NULL;

UPDATE type_of_work_settings 
SET imprint_color = '#8b5cf6' 
WHERE work_type_name = 'DTG' AND imprint_color IS NULL;

UPDATE type_of_work_settings 
SET imprint_color = '#ec4899' 
WHERE work_type_name = 'DTF' AND imprint_color IS NULL;

UPDATE type_of_work_settings 
SET imprint_color = '#f59e0b' 
WHERE work_type_name = 'Heat Transfer' AND imprint_color IS NULL;

UPDATE type_of_work_settings 
SET imprint_color = '#06b6d4' 
WHERE work_type_name = 'Sublimation' AND imprint_color IS NULL;