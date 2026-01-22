/*
  # Fix reversed payment calculation
  
  1. Problem
    - Reversed payments have negative amounts but were being excluded from calculation
    - When a $1 payment is reversed, it creates a -$1 entry that should be included
    - Current logic: $1 (successful) + 0 (reversed excluded) = $1 WRONG
    - Correct logic: $1 (successful) + (-$1) (reversed) = $0
    
  2. Solution
    - Include reversed payments in the calculation since they already have negative amounts
    
  3. Changes
    - Update recalculate_single_invoice_balance() to include reversed payments
*/

CREATE OR REPLACE FUNCTION recalculate_single_invoice_balance(p_invoice_id text)
RETURNS void AS $$
DECLARE
  v_calculated_paid numeric;
  v_invoice_total numeric;
  v_balance_remaining numeric;
  v_new_payment_status text;
BEGIN
  -- Calculate total payments for this invoice
  -- Include reversed payments since they have negative amounts
  SELECT COALESCE(SUM(CASE 
    WHEN status = 'successful' THEN amount
    WHEN status = 'reversed' THEN amount  -- Include reversed (negative amounts)
    WHEN status = 'partial_refund' THEN amount - COALESCE(refund_amount, 0)
    WHEN status = 'refunded' THEN 0  -- Exclude fully refunded
    ELSE 0
  END), 0)
  INTO v_calculated_paid
  FROM payments
  WHERE invoice_id = p_invoice_id;

  -- Get invoice total
  SELECT total INTO v_invoice_total
  FROM printavo_invoices
  WHERE id = p_invoice_id;

  -- Calculate balance
  v_balance_remaining := v_invoice_total - v_calculated_paid;

  -- Determine payment status
  IF v_balance_remaining <= 0 THEN
    v_new_payment_status := 'paid';
  ELSIF v_calculated_paid > 0 THEN
    v_new_payment_status := 'partial';
  ELSE
    v_new_payment_status := 'unpaid';
  END IF;

  -- Update the invoice
  UPDATE printavo_invoices
  SET 
    amount_paid = v_calculated_paid,
    balance_remaining = v_balance_remaining,
    amount_outstanding = v_balance_remaining,
    updated_at = now()
  WHERE id = p_invoice_id;

  -- Update billing_queue payment_status if invoice is in the queue
  UPDATE billing_queue
  SET 
    payment_status = v_new_payment_status,
    updated_at = now()
  WHERE printavo_invoice_id = p_invoice_id;

END;
$$ LANGUAGE plpgsql;

-- Recalculate all invoice balances to fix existing data
DO $$
DECLARE
  v_invoice_record RECORD;
BEGIN
  FOR v_invoice_record IN 
    SELECT DISTINCT invoice_id 
    FROM payments 
    WHERE invoice_id IS NOT NULL
  LOOP
    PERFORM recalculate_single_invoice_balance(v_invoice_record.invoice_id);
  END LOOP;
END $$;
