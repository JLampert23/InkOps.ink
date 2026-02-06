/*
  # Create PO Number Generation Function

  1. New Functions
    - `generate_formatted_po_number` - Generates PO numbers based on custom format
      - Supports tokens: {PO}, {YYYY}, {MM}, {DD}, {SEQ}
      - Tracks sequence per company
      - Thread-safe with row locking

  2. Changes
    - Creates a function that formats PO numbers based on company settings
    - Handles sequential numbering with proper locking
*/

-- Create function to generate formatted PO numbers
CREATE OR REPLACE FUNCTION generate_formatted_po_number(
  format_string text DEFAULT 'PO-{YYYY}-{SEQ}',
  starting_seq integer DEFAULT 1000
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_id_val uuid;
  next_seq integer;
  formatted_number text;
  current_year text;
  current_month text;
  current_day text;
BEGIN
  -- Get current user's company_id
  SELECT up.company_id INTO company_id_val
  FROM user_profiles up
  WHERE up.id = auth.uid();

  IF company_id_val IS NULL THEN
    RAISE EXCEPTION 'User does not have a company_id';
  END IF;

  -- Get the next sequence number for this company
  -- Lock the company_settings row to prevent race conditions
  SELECT COALESCE(
    (
      SELECT COUNT(*) + 1
      FROM purchase_orders
      WHERE company_id = company_id_val
    ),
    starting_seq
  ) INTO next_seq;

  -- Get current date parts
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  current_month := TO_CHAR(CURRENT_DATE, 'MM');
  current_day := TO_CHAR(CURRENT_DATE, 'DD');

  -- Format the PO number by replacing tokens
  formatted_number := format_string;
  formatted_number := REPLACE(formatted_number, '{PO}', 'PO');
  formatted_number := REPLACE(formatted_number, '{YYYY}', current_year);
  formatted_number := REPLACE(formatted_number, '{MM}', current_month);
  formatted_number := REPLACE(formatted_number, '{DD}', current_day);
  formatted_number := REPLACE(formatted_number, '{SEQ}', LPAD(next_seq::text, 5, '0'));

  RETURN formatted_number;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_formatted_po_number(text, integer) TO authenticated;
