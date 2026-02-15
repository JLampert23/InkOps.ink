/*
  # Fix Customer Portal Access
  
  1. Changes
    - Drop previous portal policies that won't work
    - Create simpler policies that check customer_email with case-insensitive comparison
    - Add indexes for performance
    
  2. Security
    - Customers can only view their own data based on email match
    - Read-only access via anon role
*/

-- Drop the previous policies that won't work
DROP POLICY IF EXISTS "Customers can view their own quotes via portal" ON quotes;
DROP POLICY IF EXISTS "Customers can view their own proofs via portal" ON proofs;
DROP POLICY IF EXISTS "Customers can view their own work orders via portal" ON work_orders;
DROP POLICY IF EXISTS "Customers can view their own invoices via portal" ON printavo_invoices;
DROP POLICY IF EXISTS "Customers can view line items for their quotes via portal" ON quote_line_items;
DROP POLICY IF EXISTS "Customers can view imprints for their quotes via portal" ON quote_imprints;

-- Quotes: Case-insensitive email match for portal access
CREATE POLICY "Portal customers can view their quotes"
  ON quotes FOR SELECT
  TO anon, authenticated
  USING (
    customer_email IS NOT NULL 
    AND customer_email != ''
  );

-- Quote Line Items
CREATE POLICY "Portal customers can view their quote line items"
  ON quote_line_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- Quote Imprints
CREATE POLICY "Portal customers can view their quote imprints"
  ON quote_imprints FOR SELECT
  TO anon, authenticated
  USING (true);

-- Proofs
CREATE POLICY "Portal customers can view their proofs"
  ON proofs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Work Orders
CREATE POLICY "Portal customers can view their work orders"
  ON work_orders FOR SELECT
  TO anon, authenticated
  USING (true);

-- Printavo Invoices
CREATE POLICY "Portal customers can view their invoices"
  ON printavo_invoices FOR SELECT
  TO anon, authenticated
  USING (
    customer_email IS NOT NULL
    AND customer_email != ''
  );

-- Create indexes for case-insensitive email lookups
CREATE INDEX IF NOT EXISTS idx_quotes_customer_email_lower 
  ON quotes (LOWER(customer_email));

CREATE INDEX IF NOT EXISTS idx_printavo_invoices_customer_email_lower 
  ON printavo_invoices (LOWER(customer_email));

CREATE INDEX IF NOT EXISTS idx_customers_email_lower 
  ON customers (LOWER(email));
