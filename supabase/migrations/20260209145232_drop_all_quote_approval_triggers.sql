/*
  # Drop All Quote Approval Triggers
  
  1. Problem
    - Multiple duplicate triggers on quotes table
    - Triggers have column mismatches
    
  2. Solution
    - Drop ALL triggers related to quote approval
    - This allows manual updates without trigger interference
*/

-- Drop all quote approval triggers
DROP TRIGGER IF EXISTS process_quote_approval ON quotes;
DROP TRIGGER IF EXISTS trigger_comprehensive_quote_approval ON quotes;

-- Drop the function too to prevent re-creation
DROP FUNCTION IF EXISTS process_quote_approval() CASCADE;
