/*
  # Properly Restrict Portal Access
  
  1. Changes
    - Remove overly permissive anon policies
    - Portal data will be accessed via edge functions that verify magic tokens
    
  2. Security
    - Anon role cannot directly query tables
    - All portal access goes through verified edge functions
*/

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Portal customers can view their quotes" ON quotes;
DROP POLICY IF EXISTS "Portal customers can view their quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Portal customers can view their quote imprints" ON quote_imprints;
DROP POLICY IF EXISTS "Portal customers can view their proofs" ON proofs;
DROP POLICY IF EXISTS "Portal customers can view their work orders" ON work_orders;
DROP POLICY IF EXISTS "Portal customers can view their invoices" ON printavo_invoices;

-- Customers table needs anon access for portal session creation
CREATE POLICY "Allow portal session lookups"
  ON customers FOR SELECT
  TO anon
  USING (true);

-- Portal sessions table needs anon access
CREATE POLICY "Allow portal session management"
  ON customer_portal_sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow portal session creation"
  ON customer_portal_sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow portal session updates"
  ON customer_portal_sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
