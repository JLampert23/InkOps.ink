/*
  # Backfill: Scheduler Mockup Images + Customer IDs on Invoices

  1. Fix get_first_mockup_url to handle empty strings in both key formats
  2. Backfill artwork_thumb_url on all scheduler entries where mockup data exists
  3. Backfill customer_id on printavo_invoices by matching customer_name -> customers.company_name
  4. Fix existing reversed payments: move invoice back to accounts_receivable
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bulletproof get_first_mockup_url: handles empty strings, both key formats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_first_mockup_url(mockups_array jsonb)
RETURNS text AS $$
DECLARE
  first_mockup jsonb;
  url_value text;
BEGIN
  IF mockups_array IS NULL OR jsonb_array_length(mockups_array) = 0 THEN
    RETURN NULL;
  END IF;

  first_mockup := mockups_array->0;

  -- Try 'file_url' first (from mockup generator), handle empty strings
  url_value := NULLIF(TRIM(first_mockup->>'file_url'), '');

  -- If not found or empty, try 'url' (from proof uploads)
  IF url_value IS NULL THEN
    url_value := NULLIF(TRIM(first_mockup->>'url'), '');
  END IF;

  RETURN url_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill artwork_thumb_url on all existing scheduler entries missing images
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE production_schedule_entries pse
SET artwork_thumb_url = get_first_mockup_url(qi.mockups)
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND (pse.artwork_thumb_url IS NULL OR pse.artwork_thumb_url = '')
  AND qi.mockups IS NOT NULL
  AND jsonb_array_length(qi.mockups) > 0
  AND get_first_mockup_url(qi.mockups) IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill customer_id on printavo_invoices by matching customer_name
--    This fixes the customer profile invoice history tab
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE printavo_invoices pi
SET customer_id = c.id
FROM customers c
WHERE pi.customer_id IS NULL
  AND LOWER(TRIM(pi.customer_name)) = LOWER(TRIM(c.company_name))
  AND c.company_id = pi.company_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix reversed payment invoices still showing as 'paid'
--    Move them back to accounts_receivable so they appear in the AR tab
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE printavo_invoices
SET status_stage = 'accounts_receivable',
    is_financially_locked = false,
    locked_at = NULL,
    locked_by = NULL
WHERE id IN (
  SELECT DISTINCT invoice_id
  FROM payments
  WHERE status = 'reversed'
)
AND status_stage = 'paid';

COMMENT ON FUNCTION get_first_mockup_url(jsonb) IS
  'Extracts first mockup image URL from JSONB array. Tries file_url first (mockup generator), then url (proof uploads). Handles empty strings gracefully.';
