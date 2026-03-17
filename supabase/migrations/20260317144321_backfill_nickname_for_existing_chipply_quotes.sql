/*
  # Backfill Nickname for Existing Chipply Quotes

  1. Purpose
    - Update existing Chipply-imported quotes to have nickname field populated
    - Extract store name and batch ID from the original import log JSON
    - Build nickname in the same format as new imports

  2. Solution
    - Join quotes with chipply_import_logs to access original JSON payload
    - Extract parentStoreName, batchId, and batchDate from raw_json
    - Build nickname string with same format as new imports
    - Update quotes with the generated nickname

  3. Safety
    - Only updates quotes where chipply_import_log_id IS NOT NULL
    - Only updates quotes where nickname IS NULL or empty
    - Preserves manually set nicknames
*/

-- Update existing Chipply quotes with nickname based on original import data
DO $$
DECLARE
  quote_rec RECORD;
  payload jsonb;
  account_summary jsonb;
  store_name text;
  batch_id text;
  batch_date text;
  nickname_value text;
BEGIN
  FOR quote_rec IN 
    SELECT q.id, q.valid_until, l.raw_json
    FROM quotes q
    INNER JOIN chipply_import_logs l ON l.id = q.chipply_import_log_id
    WHERE q.chipply_import_log_id IS NOT NULL
    AND (q.nickname IS NULL OR q.nickname = '')
  LOOP
    -- Extract payload, handling array wrapper
    payload := quote_rec.raw_json;
    IF jsonb_typeof(payload) = 'array' THEN
      payload := payload->0;
    END IF;
    
    -- Extract account summary
    account_summary := payload->'accountSummary';
    
    -- Extract fields
    store_name := account_summary->>'parentStoreName';
    batch_id := account_summary->>'batchId';
    batch_date := account_summary->>'batchDate';
    
    -- Build nickname
    nickname_value := COALESCE(store_name, 'Chipply Import');
    
    IF batch_id IS NOT NULL AND batch_id != '' THEN
      nickname_value := nickname_value || ' - Batch ' || batch_id;
    END IF;
    
    IF batch_date IS NOT NULL AND batch_date != '' THEN
      nickname_value := nickname_value || ' - ' || batch_date;
    ELSIF quote_rec.valid_until IS NOT NULL THEN
      nickname_value := nickname_value || ' - ' || TO_CHAR(quote_rec.valid_until, 'YYYY-MM-DD');
    END IF;
    
    -- Update the quote
    UPDATE quotes
    SET nickname = nickname_value
    WHERE id = quote_rec.id;
    
    RAISE NOTICE 'Updated quote % with nickname: %', quote_rec.id, nickname_value;
  END LOOP;
END $$;