/*
  # Add trigger to recalculate invoice balances on payment changes

  1. Problem
    - When payments are added, updated, or reversed, invoice balances don't automatically recalculate
    - The revert function calls recalculate_invoice_balances() but it doesn't always update
    
  2. Solution
    - Create a trigger function that recalculates a specific invoice's balance
    - Add triggers on INSERT, UPDATE, and DELETE of payments to automatically recalculate the affected invoice
    
  3. Changes
    - Create recalculate_single_invoice_balance(invoice_id) function
    - Add trigger on payments table for INSERT, UPDATE, DELETE
*/

-- Create function to recalculate a single invoice's balance
CREATE OR REPLACE FUNCTION recalculate_single_invoice_balance(p_invoice_id text)
RETURNS void AS $$
DECLARE
  v_calculated_paid numeric;
BEGIN
  -- Calculate total payments for this invoice
  SELECT COALESCE(SUM(CASE 
    WHEN status = 'successful' THEN amount
    WHEN status = 'partial_refund' THEN amount - COALESCE(refund_amount, 0)
    WHEN status = 'reversed' THEN amount
    ELSE 0
  END), 0)
  INTO v_calculated_paid
  FROM payments
  WHERE invoice_id = p_invoice_id;

  -- Update the invoice
  UPDATE printavo_invoices
  SET 
    amount_paid = v_calculated_paid,
    balance_remaining = total - v_calculated_paid,
    amount_outstanding = total - v_calculated_paid,
    updated_at = now()
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to recalculate invoice balance when payment changes
CREATE OR REPLACE FUNCTION trigger_recalculate_invoice_on_payment_change()
RETURNS trigger AS $$
BEGIN
  -- On INSERT or UPDATE, recalculate the new invoice
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.invoice_id IS NOT NULL THEN
    PERFORM recalculate_single_invoice_balance(NEW.invoice_id);
  END IF;
  
  -- On UPDATE, if invoice_id changed, also recalculate the old invoice
  IF (TG_OP = 'UPDATE') AND OLD.invoice_id IS NOT NULL AND OLD.invoice_id != NEW.invoice_id THEN
    PERFORM recalculate_single_invoice_balance(OLD.invoice_id);
  END IF;
  
  -- On DELETE, recalculate the old invoice
  IF (TG_OP = 'DELETE') AND OLD.invoice_id IS NOT NULL THEN
    PERFORM recalculate_single_invoice_balance(OLD.invoice_id);
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_recalculate_invoice_balance_on_payment ON payments;

-- Create trigger on payments table
CREATE TRIGGER trigger_recalculate_invoice_balance_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_invoice_on_payment_change();
