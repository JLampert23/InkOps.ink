/*
  # Update Type of Work to Support Color Type

  1. Changes
    - Replace `uses_ink` boolean column with `color_type` text column
    - `color_type` can be 'ink', 'thread', or 'none'
    - Update existing records: true -> 'ink', false -> 'thread'

  2. Notes
    - Some work types don't require colors at all (e.g., laser engraving)
    - Table may not exist yet, so we check first
*/

-- Only run if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'type_of_work_settings'
  ) THEN
    -- Add new color_type column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'type_of_work_settings'
      AND column_name = 'color_type'
    ) THEN
      ALTER TABLE type_of_work_settings
      ADD COLUMN color_type text
      CHECK (color_type IN ('ink', 'thread', 'none'))
      DEFAULT 'none';
    END IF;

    -- Migrate existing data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'type_of_work_settings'
      AND column_name = 'uses_ink'
    ) THEN
      UPDATE type_of_work_settings
      SET color_type = CASE
        WHEN uses_ink = true THEN 'ink'
        WHEN uses_ink = false THEN 'thread'
        ELSE 'none'
      END
      WHERE color_type IS NULL OR color_type = 'none';

      -- Drop the old uses_ink column
      ALTER TABLE type_of_work_settings DROP COLUMN uses_ink;
    END IF;
  END IF;
END $$;
