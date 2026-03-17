/*
  # Backfill Chipply Quote Nicknames with Formatted Dates

  1. Purpose
    - Update existing Chipply quotes to use human-readable date format
    - Change from "YYYY-MM-DD" to "Mon DD, YYYY"

  2. Changes
    - Extract store name, batch ID, and dates from existing quotes
    - Rebuild nicknames with new format
    - Only update quotes imported from Chipply (have chipply_import_log_id)
*/

DO $$
DECLARE
  v_quote_record RECORD;
  v_new_nickname text;
  v_store_name text;
  v_batch_id text;
  v_batch_date date;
  v_due_date date;
  v_log_data jsonb;
  v_account_summary jsonb;
BEGIN
  -- Loop through all Chipply-imported quotes
  FOR v_quote_record IN 
    SELECT q.id, q.chipply_import_log_id, q.valid_until, cil.raw_json
    FROM quotes q
    LEFT JOIN chipply_import_logs cil ON cil.id = q.chipply_import_log_id
    WHERE q.chipply_import_log_id IS NOT NULL
  LOOP
    -- Extract data from import log
    v_log_data := v_quote_record.raw_json;
    
    -- Handle array wrapper if present
    IF jsonb_typeof(v_log_data) = 'array' THEN
      v_log_data := v_log_data->0;
    END IF;
    
    v_account_summary := v_log_data->'accountSummary';
    
    -- Extract fields
    v_store_name := v_account_summary->>'parentStoreName';
    v_batch_id := v_account_summary->>'batchId';
    v_due_date := v_quote_record.valid_until;
    
    -- Try to extract batch date
    BEGIN
      v_batch_date := (v_account_summary->>'batchDate')::date;
    EXCEPTION WHEN OTHERS THEN
      v_batch_date := NULL;
    END;
    
    -- Build new nickname
    v_new_nickname := '';
    IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
      v_new_nickname := v_store_name;
    ELSE
      v_new_nickname := 'Chipply Import';
    END IF;
    
    IF v_batch_id IS NOT NULL AND v_batch_id <> '' THEN
      v_new_nickname := v_new_nickname || ' - Batch ' || v_batch_id;
    END IF;
    
    IF v_batch_date IS NOT NULL THEN
      v_new_nickname := v_new_nickname || ' - ' || TO_CHAR(v_batch_date, 'Mon DD, YYYY');
    ELSIF v_due_date IS NOT NULL THEN
      v_new_nickname := v_new_nickname || ' - ' || TO_CHAR(v_due_date, 'Mon DD, YYYY');
    END IF;
    
    -- Update the quote
    UPDATE quotes
    SET nickname = v_new_nickname
    WHERE id = v_quote_record.id;
    
    RAISE NOTICE 'Updated quote % with nickname: %', v_quote_record.id, v_new_nickname;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete';
END $$;