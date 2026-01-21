/*
  # Allow Negative Fundraising Credits for Deductions

  1. Changes
    - Remove the non-negative constraint on amount column
    - This allows negative entries to represent fundraising credit deductions when applied to invoices

  2. Notes
    - Positive amounts = fundraising credits earned
    - Negative amounts = fundraising credits applied to invoices
    - The net sum represents the customer's available fundraising credit balance
*/

-- Drop the existing constraint and add a new one that allows negative amounts
ALTER TABLE customer_fundraising_credits
DROP CONSTRAINT IF EXISTS customer_fundraising_credits_amount_check;

-- No constraint needed - allow any numeric value (positive for earning, negative for applying)
