/*
  # Add Line Item Group Support

  1. Purpose
    - Add support for grouping line items in quotes
    - Each group can have a label for organization

  2. Changes to `quote_line_items` table
    - Add `group_label` text field for group identification
    - Groups with empty labels are considered the default group

  3. Notes
    - The group_label field allows the UI to group related items together
    - Multiple items can share the same group_label
    - Items are still ordered by sort_order within their groups
*/

-- Add group_label to quote_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN group_label text DEFAULT '';
  END IF;
END $$;

-- Add index for efficient group queries
CREATE INDEX IF NOT EXISTS idx_quote_line_items_group_label
  ON quote_line_items(quote_id, group_label, sort_order);
