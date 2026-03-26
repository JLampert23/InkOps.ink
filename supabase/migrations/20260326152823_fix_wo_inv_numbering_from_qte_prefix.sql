/*
  # Fix Work Order and Invoice Numbering from QTE- Prefix

  ## Overview
  This migration fixes existing work orders and invoices that still have QTE- prefix instead of WO- and INV- prefixes.
  
  ## Changes
  1. **Child Tables First** (to prevent foreign key violations)
     - Update `invoice_line_items.invoice_id` to use INV- prefix
     - Update `work_order_line_items.work_order_id` to use WO- prefix
     - Update `billing_queue.printavo_invoice_id` to use INV- prefix
     - Update `production_schedule_entries.work_order_id` to use WO- prefix
  
  2. **Parent Tables**
     - Update `printavo_invoices` (id and invoice_number)
     - Update `work_orders` (id and work_order_number)
  
  3. **Trigger Function**
     - Ensure the trigger function uses WO- and INV- prefixes going forward
  
  ## Impact
  - Affects 1 work order record (WO-000001 → WO-0038)
  - Affects 1 invoice record (INV-000001 → INV-0038)
  - All transformations preserve the numeric portion of the identifier
  
  ## Example Transformation
  - QTE-0038 → WO-0038 (work orders)
  - QTE-0038 → INV-0038 (invoices)
*/

-- Step 1: Update child tables first to prevent foreign key violations

-- Update invoice_line_items table (invoice_id is text)
UPDATE invoice_line_items
SET invoice_id = REPLACE(invoice_id, 'QTE-', 'INV-')
WHERE invoice_id LIKE 'QTE-%';

-- Update work_order_line_items table (work_order_id is uuid)
UPDATE work_order_line_items
SET work_order_id = REPLACE(work_order_id::text, 'QTE-', 'WO-')::uuid
WHERE work_order_id::text LIKE 'QTE-%';

-- Update billing_queue table (printavo_invoice_id is text)
UPDATE billing_queue
SET printavo_invoice_id = REPLACE(printavo_invoice_id, 'QTE-', 'INV-')
WHERE printavo_invoice_id LIKE 'QTE-%';

-- Update production_schedule_entries table (work_order_id is uuid)
UPDATE production_schedule_entries
SET work_order_id = REPLACE(work_order_id::text, 'QTE-', 'WO-')::uuid
WHERE work_order_id::text LIKE 'QTE-%';

-- Step 2: Update parent tables

-- Update printavo_invoices table (id is text, invoice_number is text)
UPDATE printavo_invoices
SET 
  id = REPLACE(id, 'QTE-', 'INV-'),
  invoice_number = REPLACE(invoice_number, 'QTE-', 'INV-')
WHERE id LIKE 'QTE-%' OR invoice_number LIKE 'QTE-%';

-- Update work_orders table (id is uuid, work_order_number is text)
UPDATE work_orders
SET 
  id = REPLACE(id::text, 'QTE-', 'WO-')::uuid,
  work_order_number = REPLACE(work_order_number, 'QTE-', 'WO-')
WHERE id::text LIKE 'QTE-%' OR work_order_number LIKE 'QTE-%';

-- Step 3: Verify the trigger function is using correct prefixes
-- This ensures future quote approvals use WO- and INV- prefixes

CREATE OR REPLACE FUNCTION process_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_quote_number text;
  v_work_order_number text;
  v_invoice_number text;
  v_work_order_id text;
  v_invoice_id text;
  v_customer_id uuid;
  v_discount_amount numeric;
  v_tax_amount numeric;
  v_total_amount numeric;
  v_shipping_amount numeric;
BEGIN
  -- Only proceed if status changed to 'approved' and not a reopened quote
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get company_id and quote details
    v_company_id := NEW.company_id;
    v_quote_number := NEW.quote_number;
    v_customer_id := NEW.customer_id;
    v_discount_amount := COALESCE(NEW.discount_amount, 0);
    v_tax_amount := COALESCE(NEW.sales_tax, 0);
    v_shipping_amount := COALESCE(NEW.shipping_cost, 0);
    v_total_amount := COALESCE(NEW.total, 0);

    -- Generate WO and INV numbers from quote number
    v_work_order_number := REPLACE(v_quote_number, 'QTE-', 'WO-');
    v_invoice_number := REPLACE(v_quote_number, 'QTE-', 'INV-');
    v_work_order_id := v_work_order_number;
    v_invoice_id := v_invoice_number;

    -- Mark quote as converted
    NEW.status := 'converted';

    -- Create Work Order
    INSERT INTO work_orders (
      id,
      company_id,
      quote_id,
      work_order_number,
      customer_id,
      status,
      delivery_date,
      special_instructions,
      created_at
    ) VALUES (
      v_work_order_id::uuid,
      v_company_id,
      NEW.id,
      v_work_order_number,
      v_customer_id,
      'pending_scheduling',
      NEW.delivery_date,
      NEW.notes,
      NOW()
    );

    -- Create Invoice
    INSERT INTO printavo_invoices (
      id,
      company_id,
      invoice_number,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_company,
      customer_address,
      customer_city,
      customer_state,
      customer_zip,
      subtotal,
      discount_amount,
      tax_amount,
      shipping_amount,
      total,
      balance_due,
      status,
      status_stage,
      delivery_date,
      created_at,
      raw_data
    ) VALUES (
      v_invoice_id,
      v_company_id,
      v_invoice_number,
      v_customer_id,
      NEW.customer_name,
      NEW.customer_email,
      NEW.customer_phone,
      NEW.customer_company,
      NEW.customer_address,
      NEW.customer_city,
      NEW.customer_state,
      NEW.customer_zip,
      v_total_amount - v_discount_amount - v_tax_amount - v_shipping_amount,
      v_discount_amount,
      v_tax_amount,
      v_shipping_amount,
      v_total_amount,
      v_total_amount,
      'open',
      'unbilled',
      NEW.delivery_date,
      NOW(),
      jsonb_build_object(
        'quote_id', NEW.id,
        'quote_number', v_quote_number,
        'source', 'quote_approval'
      )
    );

    -- Copy line items to invoice
    INSERT INTO invoice_line_items (
      invoice_id,
      company_id,
      line_number,
      item_type,
      description,
      quantity,
      unit_price,
      total,
      garment_style,
      garment_color,
      garment_sizes
    )
    SELECT 
      v_invoice_id,
      v_company_id,
      ROW_NUMBER() OVER (ORDER BY line_number),
      item_type,
      description,
      quantity,
      unit_price,
      total,
      garment_style,
      garment_color,
      garment_sizes
    FROM quote_line_items
    WHERE quote_id = NEW.id;

    -- Copy line items to work order
    INSERT INTO work_order_line_items (
      work_order_id,
      company_id,
      line_number,
      description,
      quantity,
      garment_style,
      garment_color,
      garment_sizes
    )
    SELECT 
      v_work_order_id::uuid,
      v_company_id,
      ROW_NUMBER() OVER (ORDER BY line_number),
      description,
      quantity,
      garment_style,
      garment_color,
      garment_sizes
    FROM quote_line_items
    WHERE quote_id = NEW.id
      AND item_type = 'garment';

    -- Add to billing queue
    INSERT INTO billing_queue (
      company_id,
      printavo_invoice_id,
      customer_name,
      customer_email,
      invoice_total,
      created_at
    ) VALUES (
      v_company_id,
      v_invoice_id,
      NEW.customer_name,
      NEW.customer_email,
      v_total_amount,
      NOW()
    );

    -- Create scheduler entries for each imprint
    INSERT INTO production_schedule_entries (
      company_id,
      quote_id,
      work_order_id,
      quote_number,
      customer_name,
      production_due_date,
      type_of_work,
      quantity,
      created_at
    )
    SELECT 
      v_company_id,
      NEW.id,
      v_work_order_id::uuid,
      v_quote_number,
      NEW.customer_name,
      NEW.delivery_date,
      'screen_print',
      COALESCE(SUM(qli.quantity), 0),
      NOW()
    FROM quote_line_items qli
    WHERE qli.quote_id = NEW.id
      AND qli.item_type = 'garment'
    GROUP BY NEW.id, v_work_order_id, v_quote_number, NEW.customer_name, NEW.delivery_date;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;