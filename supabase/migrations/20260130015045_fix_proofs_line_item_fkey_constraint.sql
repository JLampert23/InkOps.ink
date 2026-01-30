/*
  # Fix proofs table foreign key constraint for line_item_id

  1. Changes
    - Drop the foreign key constraint on line_item_id
    - Proofs can now be created independently of line items
    - This allows proofs to be created from imprints or other contexts
  
  2. Reasoning
    - Proofs may be created for imprints that don't belong to specific line items
    - The line_item_id column is already nullable
    - Removing the constraint allows more flexibility in proof creation
*/

-- Drop the foreign key constraint on line_item_id
ALTER TABLE proofs 
  DROP CONSTRAINT IF EXISTS proofs_line_item_id_fkey;
