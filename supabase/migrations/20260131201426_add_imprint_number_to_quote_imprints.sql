/*
  # Add imprint_number to quote_imprints table
  
  1. Changes
    - Add `imprint_number` column to `quote_imprints` table (format: QTE-0002-01)
    - Create function to auto-generate imprint numbers
    - Create trigger to populate imprint_number on insert/update
    - Backfill existing imprints with their numbers
  
  2. Notes
    - Imprint number format: {quote_number}-{sort_order padded to 2 digits}
    - Example: QTE-0002-01, QTE-0002-02, etc.
*/

-- Add imprint_number column
ALTER TABLE quote_imprints 
ADD COLUMN IF NOT EXISTS imprint_number text;

-- Create function to generate imprint number
CREATE OR REPLACE FUNCTION generate_imprint_number()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_number text;
  v_sort_order int;
BEGIN
  -- Get the quote number from the quotes table
  SELECT quote_number INTO v_quote_number
  FROM quotes
  WHERE id = NEW.quote_id;
  
  -- Use sort_order, default to 1 if null
  v_sort_order := COALESCE(NEW.sort_order, 1);
  
  -- Generate imprint number: {quote_number}-{sort_order padded to 2 digits}
  IF v_quote_number IS NOT NULL THEN
    NEW.imprint_number := v_quote_number || '-' || LPAD(v_sort_order::text, 2, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate imprint number
DROP TRIGGER IF EXISTS generate_imprint_number_trigger ON quote_imprints;
CREATE TRIGGER generate_imprint_number_trigger
  BEFORE INSERT OR UPDATE ON quote_imprints
  FOR EACH ROW
  EXECUTE FUNCTION generate_imprint_number();

-- Backfill existing imprints with their numbers
UPDATE quote_imprints qi
SET imprint_number = q.quote_number || '-' || LPAD(COALESCE(qi.sort_order, 1)::text, 2, '0')
FROM quotes q
WHERE qi.quote_id = q.id
  AND (qi.imprint_number IS NULL OR qi.imprint_number = '');
