/*
  # Fix Screen Print Step Statuses Keys

  1. Updates
    - Rename "PRODUCTION" key to "PRODUCTION STATUS" in step_statuses JSONB for Screen Print entries
    - This aligns the database keys with the actual workflow step names

  2. Reason
    - The workflow step is named "PRODUCTION STATUS" but existing entries have the key "PRODUCTION"
    - This mismatch causes status changes not to persist correctly
*/

-- Update existing Screen Print schedule entries to rename PRODUCTION key to PRODUCTION STATUS
UPDATE production_schedule_entries
SET step_statuses = 
  CASE 
    WHEN step_statuses ? 'PRODUCTION' 
    THEN (step_statuses - 'PRODUCTION') || jsonb_build_object('PRODUCTION STATUS', step_statuses->'PRODUCTION')
    ELSE step_statuses
  END
WHERE type_of_work = 'Screen Print'
  AND step_statuses ? 'PRODUCTION';
