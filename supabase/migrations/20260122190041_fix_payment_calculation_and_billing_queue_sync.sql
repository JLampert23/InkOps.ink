/*
  # Fix payment calculation and billing queue synchronization
  
  1. Problem
    - Reversed payments are being added to amount_paid instead of being excluded
    - Refunded payments are being added instead of subtracted
    - billing_queue.payment_status is not updated when invoice balances change
    - Invoices remain locked even when they have outstanding balances
    
  2. Solution
    - Fix the payment calculation to properly handle reversed and refunded payments
    - Update billing_queue.payment_status when invoice balance changes
    - Unlock invoices that have outstanding balances
    
  3. Changes
    - Update recalculate_single_invoice_balance() to exclude reversed/refunded payments
    - Add logic to update billing_queue.payment_status
    - Create function to unlock invoices with outstanding balances
*/

-- Fix the calculation to properly exclude reversed and refunded payments
CREATE OR REPLACE FUNCTION recalculate_single_invoice_balance(p_invoice_id text)
RETURNS void AS $$
DECLARE
  v_calculated_paid numeric;
  v_invoice_total numeric;
  v_balance_remaining numeric;
  v_new_payment_status text;
BEGIN
  -- Calculate total payments for this invoice (exclude reversed and refunded)
  SELECT COALESCE(SUM(CASE 
    WHEN status = 'successful' THEN amount
    WHEN status = 'partial_refund' THEN amount - COALESCE(refund_amount, 0)
    -- REVERSED and REFUNDED should be EXCLUDED (not added)
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

-- Create function to unlock invoices with outstanding balances
CREATE OR REPLACE FUNCTION unlock_invoices_with_outstanding_balance()
RETURNS void AS $$
BEGIN
  UPDATE printavo_invoices
  SET 
    is_financially_locked = false,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
  WHERE is_financially_locked = true
    AND balance_remaining > 0;
END;
$$ LANGUAGE plpgsql;

-- Run the unlock function immediately
SELECT unlock_invoices_with_outstanding_balance();

-- Recalculate all invoice balances to ensure consistency
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
