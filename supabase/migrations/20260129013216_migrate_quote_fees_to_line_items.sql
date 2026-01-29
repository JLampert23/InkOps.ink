/*
  # Migrate Quote Fees to Line Items

  1. Changes
    - Migrates all fees from quote_fees table to quote_line_items with line_type='fee'
    - Preserves all fee data and links it correctly to quotes
    - Maintains backward compatibility by keeping quote_fees table intact

  2. Notes
    - This is a one-time migration for existing quotes
    - Future fees will be created directly in quote_line_items
*/

-- Migrate existing fees to quote_line_items
INSERT INTO quote_line_items (
  quote_id,
  company_id,
  line_number,
  line_type,
  description,
  quantity,
  unit_price,
  total_price,
  notes,
  created_at,
  updated_at
)
SELECT 
  qf.quote_id,
  q.company_id,
  9000 + row_number() OVER (PARTITION BY qf.quote_id ORDER BY qf.created_at),
  'fee',
  CASE 
    WHEN qf.description IS NOT NULL AND qf.description != '' AND qf.description != qf.fee_name 
    THEN qf.fee_name || ' - ' || qf.description
    ELSE qf.fee_name
  END,
  qf.quantity,
  qf.unit_amount::numeric,
  qf.total_amount::numeric,
  CASE 
    WHEN qf.description IS NOT NULL AND qf.description != '' AND qf.description != qf.fee_name 
    THEN qf.description
    ELSE NULL
  END,
  qf.created_at,
  qf.updated_at
FROM quote_fees qf
JOIN quotes q ON q.id = qf.quote_id
WHERE NOT EXISTS (
  -- Don't duplicate if already migrated
  SELECT 1 FROM quote_line_items qli
  WHERE qli.quote_id = qf.quote_id 
  AND qli.line_type = 'fee'
  AND qli.description LIKE qf.fee_name || '%'
);
