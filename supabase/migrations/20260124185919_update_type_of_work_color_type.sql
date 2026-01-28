/*
  # Update Type of Work to Support Color Type

  1. Changes
    - Replace `uses_ink` boolean column with `color_type` text column
    - `color_type` can be 'ink', 'thread', or 'none'
    - Update existing records: true -> 'ink', false -> 'thread'
  
  2. Notes
    - Some work types don't require colors at all (e.g., laser engraving)
*/

-- Add new color_type column
ALTER TABLE type_of_work_settings 
ADD COLUMN IF NOT EXISTS color_type text 
CHECK (color_type IN ('ink', 'thread', 'none')) 
DEFAULT 'none';

-- Migrate existing data: uses_ink = true -> 'ink', uses_ink = false -> 'thread'
UPDATE type_of_work_settings 
SET color_type = CASE 
  WHEN uses_ink = true THEN 'ink'
  WHEN uses_ink = false THEN 'thread'
  ELSE 'none'
END
WHERE color_type IS NULL OR color_type = 'none';

-- Drop the old uses_ink column
ALTER TABLE type_of_work_settings DROP COLUMN IF EXISTS uses_ink;
