/*
  # Remove duplicate payment entries

  1. Problem
    - Stripe webhook was writing to both unified payments table AND old paid_invoices table
    - Backfill migration migrated from both tables, creating duplicates
    - Some invoices have the same payment logged twice (once as stripe, once as manual)

  2. Solution
    - For stripe+manual duplicates on same day: Keep stripe, delete manual (manual was from backfilled paid_invoices)
    - For manual+manual duplicates: Keep earliest, delete later ones
    
  3. Affected Records
    - Invoice 21615083: $3.00 (stripe + manual duplicate)
    - Invoice 21666404: $5.00 (2x manual)
    - Invoice 21513669: $125.00 (3x manual)
    - Invoice 21615082: $1.00 (2x manual)
*/

-- Delete manual payment duplicates where stripe payment exists for same invoice/amount/day
DELETE FROM payments
WHERE id IN (
  SELECT p.id
  FROM payments p
  INNER JOIN payments p2 ON 
    p.invoice_id = p2.invoice_id 
    AND p.amount = p2.amount
    AND DATE(p.payment_date) = DATE(p2.payment_date)
    AND p.source = 'manual'
    AND p2.source = 'stripe'
    AND p.id != p2.id
);

-- For purely manual duplicates, keep the earliest one
DELETE FROM payments
WHERE id IN (
  WITH ranked_payments AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY invoice_id, amount, DATE(payment_date), source 
        ORDER BY created_at ASC
      ) as rn
    FROM payments
    WHERE source = 'manual'
  )
  SELECT id 
  FROM ranked_payments 
  WHERE rn > 1
);