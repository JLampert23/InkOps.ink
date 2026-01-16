/*
  # Fix status_stage when recalculating balances

  1. Problem
    - When payments are reversed, the invoice balance changes but status_stage stays 'paid'
    - Need to automatically update status_stage based on the new balance

  2. Solution
    - Update recalculate_invoice_balances() to also fix status_stage
    - If balance > 0, invoice should move from 'paid' to 'accounts_receivable'
    - If balance = 0, invoice should stay as 'paid'

  3. Logic
    - paid: balance_remaining = 0
    - accounts_receivable: balance_remaining > 0 and (payment_link sent or date_sent exists)
    - billing_queue: balance_remaining > 0 and no payment link/date sent
*/

-- Drop existing function to change return type
DROP FUNCTION IF EXISTS recalculate_invoice_balances();

-- Create updated function that also fixes status_stage based on balance
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric,
  old_status_stage text,
  new_status_stage text
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
      status_stage = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) = 0 THEN 'paid'
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 
          AND (i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL) THEN 'accounts_receivable'
        ELSE 'billing_queue'
      END,
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
        OR (
          -- Also update if status_stage is wrong for the balance
          (i.total - COALESCE(pt.calculated_paid, 0)) = 0 AND i.status_stage != 'paid'
        ) OR (
          (i.total - COALESCE(pt.calculated_paid, 0)) > 0 AND i.status_stage = 'paid'
        )
      )
    RETURNING 
      i.id,
      i.amount_paid as old_paid,
      COALESCE(pt.calculated_paid, 0) as new_paid,
      i.balance_remaining as old_bal,
      (i.total - COALESCE(pt.calculated_paid, 0)) as new_bal,
      i.status_stage as old_stage,
      CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) = 0 THEN 'paid'
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 
          AND (i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL) THEN 'accounts_receivable'
        ELSE 'billing_queue'
      END as new_stage
  )
  SELECT 
    u.id as invoice_id,
    u.old_paid as old_amount_paid,
    u.new_paid as new_amount_paid,
    u.old_bal as old_balance,
    u.new_bal as new_balance,
    u.old_stage as old_status_stage,
    u.new_stage as new_status_stage
  FROM updates u;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all invoice balances and fix status_stage
SELECT * FROM recalculate_invoice_balances();
