/*
  # Create default workflow columns for companies missing them

  1. Changes
    - Inserts default workflow columns (Pending Scheduling, In Production, Quality Check, Ready to Ship, Completed)
      for any company that doesn't already have them
  2. Notes
    - Uses a DO block to avoid duplicates via NOT EXISTS checks
*/

DO $$
DECLARE
  comp RECORD;
  default_columns TEXT[] := ARRAY['Pending Scheduling', 'In Production', 'Quality Check', 'Ready to Ship', 'Completed'];
  default_colors TEXT[] := ARRAY['#94a3b8', '#3b82f6', '#f59e0b', '#10b981', '#6b7280'];
  i INT;
BEGIN
  FOR comp IN
    SELECT DISTINCT c.id
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM production_workflow_columns pwc WHERE pwc.company_id = c.id
    )
  LOOP
    FOR i IN 1..array_length(default_columns, 1) LOOP
      INSERT INTO production_workflow_columns (company_id, column_name, column_order, color, is_default)
      VALUES (comp.id, default_columns[i], i - 1, default_colors[i], (i = 1));
    END LOOP;
  END LOOP;
END $$;
