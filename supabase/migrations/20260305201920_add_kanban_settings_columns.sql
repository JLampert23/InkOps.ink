/*
  # Add Kanban Board Settings Columns

  1. Modified Tables
    - `production_workflow_columns`
      - `wip_limit` (integer, nullable) - Maximum number of work orders allowed in this column (null = unlimited)
      - `is_visible` (boolean, default true) - Whether this column is visible on the Kanban board
      - `is_default_column` (boolean, default false) - Whether new work orders are assigned to this column by default

  2. Important Notes
    - Only one column should have is_default_column = true at a time
    - wip_limit of NULL means no limit
    - is_visible allows hiding columns without deleting them
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_workflow_columns' AND column_name = 'wip_limit'
  ) THEN
    ALTER TABLE production_workflow_columns ADD COLUMN wip_limit integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_workflow_columns' AND column_name = 'is_visible'
  ) THEN
    ALTER TABLE production_workflow_columns ADD COLUMN is_visible boolean DEFAULT true NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_workflow_columns' AND column_name = 'is_default_column'
  ) THEN
    ALTER TABLE production_workflow_columns ADD COLUMN is_default_column boolean DEFAULT false NOT NULL;
  END IF;
END $$;
