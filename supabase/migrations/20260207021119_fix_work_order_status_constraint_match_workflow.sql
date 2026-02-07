/*
  # Align work order status values with workflow board columns

  1. Changes
    - Update the status check constraint to include workflow board column names
    - Update existing 'draft' work orders to 'Pending Scheduling'
    - Clean up duplicate workflow columns
  
  2. New allowed statuses
    - Pending Scheduling, In Production, Quality Check, Ready to Ship, Completed,
      on_hold, cancelled (kept for backwards compat)
*/

-- Drop old constraint and add new one with workflow column names
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check 
  CHECK (status = ANY (ARRAY[
    'draft', 'Pending Scheduling', 'In Production', 'Quality Check', 
    'Ready to Ship', 'Completed', 'on_hold', 'cancelled',
    'in_progress', 'completed'
  ]));

-- Update existing draft work orders
UPDATE work_orders SET status = 'Pending Scheduling' WHERE status = 'draft';

-- Clean up duplicate workflow columns
DELETE FROM production_workflow_columns
WHERE id NOT IN (
  SELECT DISTINCT ON (column_name) id
  FROM production_workflow_columns
  ORDER BY column_name, created_at ASC
);
