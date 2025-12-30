/*
  # Enable RLS for calculated invoice view

  1. Security
    - Enable RLS on the calculated view
    - Allow anonymous read access (same as the base tables)
    
  2. Notes
    - The view is read-only and aggregates public data
    - Uses the same security model as printavo_invoices table
*/

ALTER VIEW printavo_invoices_calculated SET (security_invoker = on);

CREATE POLICY "Allow anonymous read access to calculated invoices"
  ON printavo_invoices
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read access to payments"
  ON printavo_payments
  FOR SELECT
  TO anon
  USING (true);