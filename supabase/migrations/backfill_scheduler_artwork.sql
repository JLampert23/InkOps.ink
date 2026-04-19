-- Backfill artwork_thumb_url for existing production_schedule_entries
-- Pulls artwork_url from quote_imprints as the thumbnail for all entries
-- that currently have no image set.

UPDATE production_schedule_entries pse
SET artwork_thumb_url = qi.artwork_url
FROM quote_imprints qi
WHERE pse.imprint_id = qi.id
  AND pse.artwork_thumb_url IS NULL
  AND qi.artwork_url IS NOT NULL;

-- Confirm results
SELECT 
  COUNT(*) FILTER (WHERE artwork_thumb_url IS NOT NULL) AS entries_with_image,
  COUNT(*) FILTER (WHERE artwork_thumb_url IS NULL) AS entries_without_image
FROM production_schedule_entries;
