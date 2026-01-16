/*
  # Include reversed payments in invoice balance calculation

  1. Problem
    - Reversed payments are not being included in invoice balance calculations
    - When a payment is reversed, the invoice balance should increase (since a negative payment is added)
    - Currently only 'successful' and 'partial_refund' statuses are considered

  2. Solution
    - Update the recalculate_invoice_balances() function to include reversed payments
    - Reversed payments have negative amounts, so they will naturally reduce amount_paid
    - This will increase the balance_remaining when a payment is reversed

  3. Updated Calculation Logic
    - amount_paid = SUM(payment.amount) WHERE status='successful'
                   + SUM(payment.amount - payment.refund_amount) WHERE status='partial_refund'
                   + SUM(payment.amount) WHERE status='reversed' (negative amounts)
    - balance_remaining = total - amount_paid
    - amount_outstanding = balance_remaining
*/

-- Update function to include reversed payments in balance calculation
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
      -- Count successful payments at full amount
      -- Count partial refunds at (amount - refund_amount)
      -- Count reversed payments at their negative amount (reduces total paid)
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        WHEN p.status = 'reversed' THEN p.amount
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

-- Recalculate all invoice balances to fix any existing discrepancies
SELECT * FROM recalculate_invoice_balances();
