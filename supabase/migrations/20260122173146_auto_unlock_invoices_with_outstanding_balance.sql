/*
  # Auto-unlock invoices when payments are refunded

  1. Problem
    - When payments are refunded, invoices remain locked even though they have outstanding balances
    - Locked invoices with balances cannot be modified or sent for payment
    - Invoices 60003448 and 60003444 are locked but have outstanding balances

  2. Solution
    - Update recalculate_invoice_balances() to automatically unlock invoices that have outstanding balances
    - An invoice should only be locked if it's fully paid (balance_remaining <= 0)
    - When a payment is refunded and balance > 0, the invoice should be unlocked

  3. Logic
    - If balance_remaining > 0 AND is_financially_locked = true, then unlock the invoice
    - Set is_financially_locked = false, locked_at = NULL, locked_by = NULL
*/

-- Drop existing function to change return type
DROP FUNCTION IF EXISTS recalculate_invoice_balances();

-- Update the recalculate_invoice_balances function to auto-unlock invoices with balances
CREATE OR REPLACE FUNCTION recalculate_invoice_balances()
RETURNS TABLE(
  invoice_id text,
  invoice_number text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  old_balance numeric,
  new_balance numeric,
  old_status_stage text,
  new_status_stage text,
  was_unlocked boolean
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      p.invoice_id,
      -- Only count successful payments and partial refunds
      -- Exclude: failed, refunded, reversed
      COALESCE(SUM(CASE 
        WHEN p.status = 'successful' THEN p.amount
        WHEN p.status = 'partial_refund' THEN p.amount - COALESCE(p.refund_amount, 0)
        ELSE 0
      END), 0) as calculated_paid
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
      AND p.status NOT IN ('failed', 'refunded', 'reversed')
    GROUP BY p.invoice_id
  ),
  current_values AS (
    SELECT 
      i.id,
      i.invoice_number,
      i.amount_paid as old_paid,
      i.balance_remaining as old_balance,
      i.status_stage as old_stage,
      i.is_financially_locked
    FROM printavo_invoices i
  ),
  updates AS (
    UPDATE printavo_invoices i
    SET 
      amount_paid = COALESCE(pt.calculated_paid, 0),
      balance_remaining = i.total - COALESCE(pt.calculated_paid, 0),
      amount_outstanding = i.total - COALESCE(pt.calculated_paid, 0),
      status_stage = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) <= 0 THEN 'paid'
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 
          AND (i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL) THEN 'accounts_receivable'
        ELSE 'billing_queue'
      END,
      -- Auto-unlock invoices with outstanding balances
      is_financially_locked = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 THEN false
        ELSE i.is_financially_locked
      END,
      locked_at = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 THEN NULL
        ELSE i.locked_at
      END,
      locked_by = CASE
        WHEN (i.total - COALESCE(pt.calculated_paid, 0)) > 0 THEN NULL
        ELSE i.locked_by
      END,
      updated_at = now()
    FROM payment_totals pt
    WHERE i.id = pt.invoice_id
      AND (
        i.amount_paid != COALESCE(pt.calculated_paid, 0)
        OR i.balance_remaining != (i.total - COALESCE(pt.calculated_paid, 0))
        OR (
          -- Fix status_stage if it's wrong for the balance
          (i.total - COALESCE(pt.calculated_paid, 0)) <= 0 AND i.status_stage != 'paid'
        ) OR (
          (i.total - COALESCE(pt.calculated_paid, 0)) > 0 AND i.status_stage = 'paid'
        ) OR (
          -- Unlock if has outstanding balance
          (i.total - COALESCE(pt.calculated_paid, 0)) > 0 AND i.is_financially_locked = true
        )
      )
    RETURNING i.id
  )
  SELECT 
    cv.id as invoice_id,
    cv.invoice_number,
    cv.old_paid as old_amount_paid,
    COALESCE(pt.calculated_paid, 0) as new_amount_paid,
    cv.old_balance as old_balance,
    i.balance_remaining as new_balance,
    cv.old_stage as old_status_stage,
    i.status_stage as new_status_stage,
    (cv.is_financially_locked = true AND i.is_financially_locked = false) as was_unlocked
  FROM updates u
  JOIN current_values cv ON cv.id = u.id
  JOIN printavo_invoices i ON i.id = u.id
  LEFT JOIN payment_totals pt ON pt.invoice_id = u.id;
END;
$$;

-- Also update invoices that have no payments but wrong balance or are incorrectly locked
UPDATE printavo_invoices i
SET 
  amount_paid = 0,
  balance_remaining = i.total,
  amount_outstanding = i.total,
  status_stage = CASE
    WHEN i.payment_link IS NOT NULL OR i.date_sent IS NOT NULL THEN 'accounts_receivable'
    ELSE 'billing_queue'
  END,
  -- Unlock if has outstanding balance
  is_financially_locked = false,
  locked_at = NULL,
  locked_by = NULL,
  updated_at = now()
WHERE i.id NOT IN (SELECT DISTINCT invoice_id FROM payments WHERE invoice_id IS NOT NULL)
  AND (
    i.amount_paid != 0
    OR i.balance_remaining != i.total
    OR i.status_stage = 'paid'
    OR i.is_financially_locked = true
  );

-- Run the function to fix all existing invoices
SELECT * FROM recalculate_invoice_balances();
