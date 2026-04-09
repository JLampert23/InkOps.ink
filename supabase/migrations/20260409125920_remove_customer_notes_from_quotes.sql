/*
  # Remove customer_notes from quotes table

  ## Summary
  Drops the `customer_notes` column from the `quotes` table.

  ## Changes
  - **quotes**: Removes `customer_notes text` column and all associated test data

  ## Notes
  - This is a safe destructive operation — data confirmed as test data only
  - All application references to this column will be removed from code simultaneously
*/

ALTER TABLE quotes DROP COLUMN IF EXISTS customer_notes;
