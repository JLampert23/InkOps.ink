/*
  # Allow negative amounts for reversed payments

  1. Changes
    - Drop existing amount check constraint
    - Add new check constraint that allows:
      - Positive amounts for all statuses except 'reversed'
      - Negative amounts only for 'reversed' status
    - This enables payment reversals to use negative amounts

  2. Security
    - No RLS changes needed
*/

-- Drop the existing check constraint(s)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS valid_payment_amount;

-- Add new check constraint that allows negative amounts for reversed payments
ALTER TABLE payments 
ADD CONSTRAINT valid_payment_amount 
CHECK (
  (status = 'reversed' AND amount < 0) OR
  (status != 'reversed' AND amount > 0)
);
