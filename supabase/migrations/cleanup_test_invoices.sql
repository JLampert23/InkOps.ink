-- =============================================================
-- INKOPS: CLEAR ALL TEST INVOICE DATA
-- Run this in Supabase SQL Editor ONLY when ready to go live.
-- This is IRREVERSIBLE. Please confirm with client before running.
-- =============================================================

-- Step 1: Delete manual payments linked to invoices
DELETE FROM payments
WHERE invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 2: Delete printavo payments
DELETE FROM printavo_payments
WHERE invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 3: Delete stripe payments
DELETE FROM stripe_payments
WHERE printavo_invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 4: Delete stripe invoices
DELETE FROM stripe_invoices
WHERE printavo_invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 5: Delete stripe payment links
DELETE FROM stripe_payment_links
WHERE printavo_invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 6: Delete billing queue entries
DELETE FROM billing_queue
WHERE printavo_invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 7: Delete communication logs
DELETE FROM communication_logs
WHERE printavo_invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 8: Delete shipping labels
DELETE FROM shipping_labels
WHERE invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 9: Delete invoice line items
DELETE FROM invoice_line_items
WHERE invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 10: Delete printavo line items
DELETE FROM printavo_line_items
WHERE invoice_id IN (
  SELECT id FROM printavo_invoices
  WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41'
);

-- Step 11: Delete paid_invoices records
DELETE FROM paid_invoices
WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41';

-- Step 12: Finally delete the invoices themselves
DELETE FROM printavo_invoices
WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41';

-- Confirm cleanup
SELECT 
  (SELECT COUNT(*) FROM printavo_invoices WHERE company_id = '5f36fe64-8b67-4b62-a023-29590da87c41') AS invoices_remaining,
  (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id NOT IN (SELECT id FROM printavo_invoices)) AS orphaned_line_items;
