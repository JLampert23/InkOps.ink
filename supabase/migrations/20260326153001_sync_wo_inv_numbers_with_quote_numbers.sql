/*
  # Sync Work Order and Invoice Numbers with Quote Numbers

  ## Overview
  This migration updates work order and invoice numbers to match their associated quote numbers.
  Currently, WO-000001 and INV-000001 should be WO-0038 and INV-0038 to match quote QTE-0038.
  
  ## Changes
  1. Temporarily drop foreign key constraints that block updates
  2. Update all records to use the correct numbering from their quote
  3. Recreate foreign key constraints with ON UPDATE CASCADE for future updates
  
  ## Impact
  - Affects 1 work order: WO-000001 → WO-0038
  - Affects 1 invoice: INV-000001 → INV-0038
  - Updates all related child records
*/

-- Step 1: Drop foreign key constraints temporarily
ALTER TABLE invoice_line_items 
DROP CONSTRAINT IF EXISTS invoice_line_items_invoice_id_fkey;

ALTER TABLE billing_queue 
DROP CONSTRAINT IF EXISTS billing_queue_printavo_invoice_id_fkey;

-- Step 2: Store the mapping of old to new invoice IDs
CREATE TEMP TABLE invoice_id_mapping AS
SELECT 
  pi.id as old_id,
  REPLACE(q.quote_number, 'QTE-', 'INV-') as new_id
FROM printavo_invoices pi
JOIN quotes q ON q.id::text = pi.raw_data->>'quote_id';

-- Step 3: Update child tables to use new invoice IDs
UPDATE invoice_line_items ili
SET invoice_id = m.new_id
FROM invoice_id_mapping m
WHERE ili.invoice_id = m.old_id;

UPDATE billing_queue bq
SET printavo_invoice_id = m.new_id
FROM invoice_id_mapping m
WHERE bq.printavo_invoice_id = m.old_id;

-- Step 4: Update parent invoice table
UPDATE printavo_invoices pi
SET 
  id = m.new_id,
  invoice_number = m.new_id
FROM invoice_id_mapping m
WHERE pi.id = m.old_id;

-- Step 5: Update work_orders (work_order_number only, id stays as UUID)
UPDATE work_orders w
SET work_order_number = REPLACE(q.quote_number, 'QTE-', 'WO-')
FROM quotes q
WHERE w.quote_id = q.id;

-- Step 6: Recreate foreign key constraints with ON UPDATE CASCADE
ALTER TABLE invoice_line_items
ADD CONSTRAINT invoice_line_items_invoice_id_fkey
FOREIGN KEY (invoice_id)
REFERENCES printavo_invoices(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

ALTER TABLE billing_queue
ADD CONSTRAINT billing_queue_printavo_invoice_id_fkey
FOREIGN KEY (printavo_invoice_id)
REFERENCES printavo_invoices(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- Step 7: Clean up temp table
DROP TABLE invoice_id_mapping;