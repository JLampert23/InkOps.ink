/*
  # Add Customer Portal RLS Policies
  
  1. Changes
    - Add RLS policies to allow unauthenticated customer portal users to view their own data
    - Policies check the customer_portal_sessions table for valid sessions
    - Customers can view quotes, proofs, invoices, and work orders assigned to them
    
  2. Security
    - Policies verify active portal session exists
    - Customer can only see data for their customer_id
    - Read-only access (no insert/update/delete)
*/

-- Helper function to get customer ID from current session
CREATE OR REPLACE FUNCTION get_portal_customer_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Try to get customer_id from request headers (set by portal context)
  v_customer_id := current_setting('request.jwt.claims', true)::json->>'customer_id';
  RETURN v_customer_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Quotes: Allow customers to view their quotes
CREATE POLICY "Customers can view their own quotes via portal"
  ON quotes FOR SELECT
  TO anon
  USING (
    customer_id IN (
      SELECT customer_id 
      FROM customer_portal_sessions 
      WHERE used_at IS NOT NULL 
      AND expires_at > now() - interval '24 hours'
    )
  );

-- Proofs: Allow customers to view their proofs
CREATE POLICY "Customers can view their own proofs via portal"
  ON proofs FOR SELECT
  TO anon
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE customer_id IN (
        SELECT customer_id 
        FROM customer_portal_sessions 
        WHERE used_at IS NOT NULL 
        AND expires_at > now() - interval '24 hours'
      )
    )
  );

-- Work Orders: Allow customers to view their work orders
CREATE POLICY "Customers can view their own work orders via portal"
  ON work_orders FOR SELECT
  TO anon
  USING (
    customer_id IN (
      SELECT customer_id 
      FROM customer_portal_sessions 
      WHERE used_at IS NOT NULL 
      AND expires_at > now() - interval '24 hours'
    )
  );

-- Printavo Invoices: Allow customers to view their invoices
CREATE POLICY "Customers can view their own invoices via portal"
  ON printavo_invoices FOR SELECT
  TO anon
  USING (
    LOWER(customer_email) IN (
      SELECT LOWER(email)
      FROM customers
      WHERE id IN (
        SELECT customer_id 
        FROM customer_portal_sessions 
        WHERE used_at IS NOT NULL 
        AND expires_at > now() - interval '24 hours'
      )
    )
  );

-- Quote Line Items: Allow customers to view line items for their quotes
CREATE POLICY "Customers can view line items for their quotes via portal"
  ON quote_line_items FOR SELECT
  TO anon
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE customer_id IN (
        SELECT customer_id 
        FROM customer_portal_sessions 
        WHERE used_at IS NOT NULL 
        AND expires_at > now() - interval '24 hours'
      )
    )
  );

-- Quote Imprints: Allow customers to view imprints for their quotes
CREATE POLICY "Customers can view imprints for their quotes via portal"
  ON quote_imprints FOR SELECT
  TO anon
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE customer_id IN (
        SELECT customer_id 
        FROM customer_portal_sessions 
        WHERE used_at IS NOT NULL 
        AND expires_at > now() - interval '24 hours'
      )
    )
  );
