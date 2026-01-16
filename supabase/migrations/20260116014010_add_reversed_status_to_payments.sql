/*
  # Add 'reversed' status to payments table

  1. Changes
    - Drop existing status check constraint
    - Add new status check constraint that includes 'reversed'
    - 'reversed' is used for manual payment reversals

  2. Security
    - No RLS changes needed
*/

-- Drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- Add new check constraint with 'reversed' included
ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IN ('successful', 'failed', 'refunded', 'pending', 'partial_refund', 'reversed'));
