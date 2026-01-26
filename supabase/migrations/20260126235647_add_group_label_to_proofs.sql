/*
  # Add Group Label to Proofs Table

  1. Changes
    - Add `group_label` column to `proofs` table
    - This allows proofs to be associated with specific line item groups
    - Each group can have its own isolated set of proofs

  2. Notes
    - group_label should match the group_label on quote_line_items
    - This enables proper isolation of proofs per line item group
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proofs' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE proofs ADD COLUMN group_label text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proofs_group_label ON proofs(group_label);