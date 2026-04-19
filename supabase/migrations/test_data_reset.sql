/*
  # TEST DATA RESET
  ⚠️  WARNING: This deletes all payments, invoices, work orders, and scheduler entries
  ⚠️  and resets all quotes back to draft status.
  ⚠️  ONLY RUN THIS IN A TEST/STAGING ENVIRONMENT - NOT PRODUCTION.
  
  Run each block carefully and verify before proceeding.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Delete payments
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM payments;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Delete invoice line items and invoices
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM invoice_line_items;
DELETE FROM printavo_invoices;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Delete scheduler entries
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM production_schedule_entries;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Delete work order line items and work orders
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM work_order_line_items;
DELETE FROM work_orders;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Clear garment requirements staging
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM garment_requirements_staging;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: Reset quotes back to draft
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE quotes
SET 
  status = 'draft',
  is_locked = false,
  approved_at = NULL,
  approved_by_name = NULL,
  approved_by_email = NULL,
  approved_ip = NULL,
  converted_at = NULL,
  production_job_id = NULL
WHERE status IN ('approved', 'pending_approval');

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7: Delete quote approvals and responses (so quotes can be re-sent)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM quote_approval_responses;
DELETE FROM quote_approvals;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 8: Delete billing queue entries
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM billing_queue;

-- Done — quotes are now in draft, all downstream data cleared.
-- You can now re-approve quotes from scratch to test the full flow.
SELECT 'Reset complete. Quotes reset to draft.' as status;
