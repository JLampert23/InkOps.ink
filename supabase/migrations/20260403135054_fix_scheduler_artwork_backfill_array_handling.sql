/*
  # Fix Scheduler Artwork Backfill - Correct Array Handling

  1. Problem
    - Previous backfill migration treated `mockups` as an object
    - `mockups` is actually a JSONB array, not an object
    - Used `jsonb_each_text` which only works on objects, not arrays

  2. Solution
    - Extract URL from first array element: `mockups->0->>'url'`
    - Also check for `file_url` property: `mockups->0->>'file_url'`
    - Check `artwork_url`, `artwork_images` array as additional sources

  3. Changes
    - Updates `production_schedule_entries.artwork_thumb_url` for all entries with linked imprints
*/

-- Fix artwork_thumb_url using correct array access for mockups
UPDATE production_schedule_entries pse
SET artwork_thumb_url = COALESCE(
  -- First try artwork_url directly
  qi.artwork_url,
  -- Then try first element of artwork_images array
  qi.artwork_images->0->>'url',
  -- Then try first mockup's url property
  qi.mockups->0->>'url',
  -- Finally try first mockup's file_url property (alternative format)
  qi.mockups->0->>'file_url'
)
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND pse.artwork_thumb_url IS NULL
  AND (
    qi.artwork_url IS NOT NULL
    OR (qi.artwork_images IS NOT NULL AND jsonb_array_length(qi.artwork_images) > 0)
    OR (qi.mockups IS NOT NULL AND jsonb_array_length(qi.mockups) > 0)
  );