/*
  # Add fundraising_credit to valid payment types
  
  Updates the check constraint to allow 'fundraising_credit' as a valid payment type.
*/

-- Drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS valid_payment_type;

-- Add the updated check constraint with fundraising_credit
ALTER TABLE payments ADD CONSTRAINT valid_payment_type 
  CHECK (payment_type IS NULL OR payment_type IN ('cash', 'debit_credit', 'check_ach', 'stripe', 'other', 'fundraising_credit'));
