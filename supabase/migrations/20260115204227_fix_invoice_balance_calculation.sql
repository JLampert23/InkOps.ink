/*
  # Fix Invoice Balance Calculation

  1. Problem
    - Refunded payments are incorrectly affecting invoice balances
    - Invoice amount_paid field is not properly calculating based on payment status
    - Refunded payments should be excluded from balance calculations

  2. Solution
    - Create a function to recalculate invoice balances correctly
    - Only count 'successful' payments
    - Exclude 'refunded' payments entirely
    - For 'partial_refund', subtract the refund_amount
    - Run the function to fix all existing invoices

  3. Calculation Logic
    - amount_paid = SUM(payment.amount) WHERE status='successful'
                   + SUM(payment.amount - payment.refund_amount) WHERE status='partial_refund'
    - balance_remaining = total - amount_paid
    - amount_outstanding = balance_remaining
*/

-- Create function to recalculate invoice balances
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      p.invoice_id,
      -- Only count successful payments at full amount
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        ELSE 0
      END), 0) as calculated_paid
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
  ),
  updates AS (
    UPDATE printavo_invoices i
    SET 
      amount_paid = COALESCE(pt.calculated_paid, 0),
      balance_remaining = i.total - COALESCE(pt.calculated_paid, 0),
      amount_outstanding = i.total - COALESCE(pt.calculated_paid, 0),
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
      )
    RETURNING 
      i.id,
      i.amount_paid as old_paid,
      COALESCE(pt.calculated_paid, 0) as new_paid,
      i.balance_remaining as old_bal,
      (i.total - COALESCE(pt.calculated_paid, 0)) as new_bal
  )
  SELECT 
    u.id as invoice_id,
    u.old_paid as old_amount_paid,
    u.new_paid as new_amount_paid,
    u.old_bal as old_balance,
    u.new_bal as new_balance
  FROM updates u;
END;
$$ LANGUAGE plpgsql;

-- Run the recalculation
SELECT * FROM recalculate_invoice_balances();
