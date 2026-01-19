/*
  # Add Company Isolation to Printavo Child Tables
  
  ## Problem
  printavo_payments and printavo_line_items don't have company_id columns,
  so they can't filter by company. This allows users to see all payments and
  line items across all companies.
  
  ## Solution
  1. Add company_id column to both tables
  2. Backfill company_id from the related invoice
  3. Drop insecure RLS policies
  4. Create secure company-specific RLS policies
  5. Update the view to respect company isolation
  
  ## Security Impact
  After this fix, users will only see payments and line items belonging to
  invoices in their company.
*/

-- Add company_id to printavo_payments
ALTER TABLE printavo_payments 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to printavo_line_items
ALTER TABLE printavo_line_items 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Backfill company_id from invoices for payments
UPDATE printavo_payments p
SET company_id = i.company_id
FROM printavo_invoices i
WHERE p.invoice_id = i.id
  AND p.company_id IS NULL;

-- Backfill company_id from invoices for line items
UPDATE printavo_line_items li
SET company_id = i.company_id
FROM printavo_invoices i
WHERE li.invoice_id = i.id
  AND li.company_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_line_items_company_id ON printavo_line_items(company_id);

-- Drop all insecure policies
DROP POLICY IF EXISTS "Allow read access to payments" ON printavo_payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON printavo_payments;
DROP POLICY IF EXISTS "Allow authenticated read access to line items" ON printavo_line_items;

-- Create secure company-specific policies for printavo_payments
CREATE POLICY "Users can view payments in their company"
  ON printavo_payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert payments for their company"
  ON printavo_payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update payments in their company"
  ON printavo_payments FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete payments in their company"
  ON printavo_payments FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Create secure company-specific policies for printavo_line_items
CREATE POLICY "Users can view line items in their company"
  ON printavo_line_items FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert line items for their company"
  ON printavo_line_items FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update line items in their company"
  ON printavo_line_items FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete line items in their company"
  ON printavo_line_items FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Recreate the calculated view to include company_id
DROP VIEW IF EXISTS printavo_invoices_calculated;

CREATE VIEW printavo_invoices_calculated AS
SELECT 
  i.id,
  i.invoice_number,
  i.customer_email,
  i.customer_name,
  i.customer_company,
  i.subtotal,
  i.tax,
  i.total,
  i.company_id,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  GREATEST(i.total - COALESCE(SUM(p.amount), 0), 0) AS amount_outstanding,
  CASE
    WHEN i.total <= COALESCE(SUM(p.amount), 0) THEN true
    ELSE false
  END AS paid_in_full,
  i.status,
  i.invoice_date,
  i.due_date,
  i.created_at,
  i.updated_at,
  i.raw_data
FROM printavo_invoices i
LEFT JOIN printavo_payments p ON p.invoice_id = i.id AND p.company_id = i.company_id
GROUP BY 
  i.id, 
  i.invoice_number, 
  i.customer_email, 
  i.customer_name, 
  i.customer_company, 
  i.subtotal, 
  i.tax, 
  i.total,
  i.company_id,
  i.status, 
  i.invoice_date, 
  i.due_date, 
  i.created_at, 
  i.updated_at, 
  i.raw_data;

-- Grant access to the view for authenticated users
GRANT SELECT ON printavo_invoices_calculated TO authenticated;
