/*
  # Disable Auto-Trigger for Chipply Import
  
  1. Changes
    - Drop the auto-trigger that runs on INSERT
    - Let the edge function call the processor manually
*/

DROP TRIGGER IF EXISTS trg_auto_process_chipply_import ON chipply_import_logs;
DROP FUNCTION IF EXISTS trigger_process_chipply_import();
