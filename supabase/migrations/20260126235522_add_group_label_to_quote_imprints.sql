/*
  # Add Group Label to Quote Imprints

  1. Changes
    - Add `group_label` column to `quote_imprints` table
    - This allows imprints to be associated with specific line item groups
    - Each group can have its own isolated set of imprints and mockups

  2. Notes
    - group_label should match the group_label on quote_line_items
    - This enables proper isolation of mockups/proofs per line item group
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_imprints' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE quote_imprints ADD COLUMN group_label text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quote_imprints_group_label ON quote_imprints(group_label);