-- Fix: Allow negative amounts in payments table for reversal entries
-- Previously the constraint only allowed amount > 0, blocking payment reversals

ALTER TABLE payments DROP CONSTRAINT IF EXISTS valid_payment_amount;

ALTER TABLE payments ADD CONSTRAINT valid_payment_amount 
  CHECK (amount != 0);

-- Confirm constraint was updated
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'valid_payment_amount';
