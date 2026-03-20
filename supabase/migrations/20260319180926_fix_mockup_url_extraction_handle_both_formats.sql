/*
  # Fix Mockup URL Extraction to Handle Both Formats

  1. Changes
    - Update get_first_mockup_url to handle both 'file_url' and 'url' keys
    - Re-run backfill to update entries with the corrected function

  2. Purpose
    - Support both mockup formats (file_url from mockup generator, url from proofs)
*/

-- Update helper function to handle both 'file_url' and 'url' keys
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
  
  -- Try 'file_url' first (from mockup generator)
  url_value := first_mockup->>'file_url';
  
  -- If not found, try 'url' (from proofs)
  IF url_value IS NULL THEN
    url_value := first_mockup->>'url';
  END IF;

  RETURN url_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Re-run backfill with corrected function
UPDATE production_schedule_entries pse
SET artwork_thumb_url = get_first_mockup_url(qi.mockups)
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND pse.artwork_thumb_url IS NULL
  AND qi.mockups IS NOT NULL
  AND jsonb_array_length(qi.mockups) > 0;

COMMENT ON FUNCTION get_first_mockup_url(jsonb) IS 'Extracts the first mockup URL from a mockups JSONB array, supporting both file_url and url keys';
