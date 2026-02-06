-- Fix 1: Replace line 13547 with safe DROP COLUMN
DO $$
BEGIN
  -- Only drop if it's a table (not a view) and column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'type_of_work_settings'
    AND table_type = 'BASE TABLE'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'type_of_work_settings'
    AND column_name = 'uses_ink'
  ) THEN
    ALTER TABLE type_of_work_settings DROP COLUMN uses_ink;
  END IF;
END $$;

-- Fix 2: Replace lines 13907-13910 with safe DROP COLUMN
DO $$
BEGIN
  -- Only drop if it's a table (not a view)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'company_settings'
    AND table_type = 'BASE TABLE'
  ) THEN
    -- Drop columns one by one with IF EXISTS
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'use_quote_prefix'
    ) THEN
      ALTER TABLE company_settings DROP COLUMN use_quote_prefix;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'quote_prefix'
    ) THEN
      ALTER TABLE company_settings DROP COLUMN quote_prefix;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'quote_start_number'
    ) THEN
      ALTER TABLE company_settings DROP COLUMN quote_start_number;
    END IF;
  END IF;
END $$;
