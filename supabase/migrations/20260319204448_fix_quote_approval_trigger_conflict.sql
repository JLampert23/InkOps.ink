/*
  # Fix Quote Approval Trigger Conflict

  1. Problem
    - The `process_quote_approval()` trigger was supposed to be dropped but still exists
    - It's creating duplicate work orders and invoices when quotes are approved
    - It's not preserving the status change, causing quotes to revert to 'draft'
    - The edge function `quote-actions/approve` is the correct way to approve quotes
    
  2. Solution
    - Drop the trigger completely
    - Drop the function completely
    - The edge function handles all approval logic including:
      * Creating work orders
      * Creating invoices  
      * Creating garment requirements
      * Creating schedule entries
      * Updating quote status to 'approved'
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_comprehensive_quote_approval ON quotes;

-- Drop the function
DROP FUNCTION IF EXISTS process_quote_approval() CASCADE;

-- Verify no orphaned triggers remain
DO $$
BEGIN
  -- This will error if the trigger still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_comprehensive_quote_approval'
    AND event_object_table = 'quotes'
  ) THEN
    RAISE EXCEPTION 'Trigger still exists after drop';
  END IF;
END $$;
