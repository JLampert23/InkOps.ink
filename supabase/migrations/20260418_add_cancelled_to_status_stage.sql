-- Fix: Add 'cancelled' to the printavo_invoices status_stage check constraint
-- The cancel invoice feature was built in the UI but 'cancelled' was never
-- added to the database constraint, causing a 400 error on cancel.

ALTER TABLE printavo_invoices 
  DROP CONSTRAINT IF EXISTS printavo_invoices_status_stage_check;

ALTER TABLE printavo_invoices 
  ADD CONSTRAINT printavo_invoices_status_stage_check 
  CHECK (status_stage IN ('billing_queue', 'accounts_receivable', 'paid', 'cancelled'));
