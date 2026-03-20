/*
  # Add Custom Invoice Status to Work Orders

  1. Schema Changes
    - Add `custom_invoice_status_id` column to `work_orders` table
      - Type: uuid (nullable)
      - Foreign key reference to custom_invoice_statuses table
      - Allows tracking invoice/billing status at work order level
    
  2. Indexes
    - Add index on `custom_invoice_status_id` for efficient filtering/joins
  
  3. Purpose
    - Enable tracking of invoice status directly on work orders
    - Support filtering work orders by invoice status
    - Integrate with automation system for status change triggers
*/

-- Add custom_invoice_status_id column to work_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'custom_invoice_status_id'
  ) THEN
    ALTER TABLE work_orders
    ADD COLUMN custom_invoice_status_id uuid REFERENCES custom_invoice_statuses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient filtering by invoice status
CREATE INDEX IF NOT EXISTS idx_work_orders_custom_invoice_status_id
  ON work_orders(custom_invoice_status_id)
  WHERE custom_invoice_status_id IS NOT NULL;

-- Create composite index for company + invoice status filtering
CREATE INDEX IF NOT EXISTS idx_work_orders_company_invoice_status
  ON work_orders(company_id, custom_invoice_status_id);
