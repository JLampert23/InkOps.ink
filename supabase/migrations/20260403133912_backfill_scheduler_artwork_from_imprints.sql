/*
  # Backfill Artwork URLs for Production Schedule Entries

  1. Purpose
    - Populate artwork_thumb_url for existing schedule entries
    - Pull artwork from linked quote_imprints records
    
  2. Logic
    - Join production_schedule_entries with quote_imprints on imprint_id
    - Update artwork_thumb_url with the imprint's artwork_url
    - If artwork_url is null, try artwork_images array first element
    - If that's null, try mockups object first value
    
  3. Scope
    - Only updates entries where artwork_thumb_url is currently NULL
    - Only updates where a matching imprint exists
*/

-- Update schedule entries from quote_imprints artwork_url
UPDATE production_schedule_entries pse
SET artwork_thumb_url = qi.artwork_url
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND pse.artwork_thumb_url IS NULL
  AND qi.artwork_url IS NOT NULL;

-- Update remaining entries from artwork_images array (first element)
UPDATE production_schedule_entries pse
SET artwork_thumb_url = qi.artwork_images->>0
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND pse.artwork_thumb_url IS NULL
  AND qi.artwork_images IS NOT NULL
  AND jsonb_typeof(qi.artwork_images) = 'array'
  AND jsonb_array_length(qi.artwork_images) > 0;

-- Update remaining entries from mockups (first value) - only for object type mockups
UPDATE production_schedule_entries pse
SET artwork_thumb_url = (
  SELECT value
  FROM jsonb_each_text(qi.mockups)
  LIMIT 1
)
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND pse.artwork_thumb_url IS NULL
  AND qi.mockups IS NOT NULL
  AND jsonb_typeof(qi.mockups) = 'object'
  AND qi.mockups != '{}'::jsonb;